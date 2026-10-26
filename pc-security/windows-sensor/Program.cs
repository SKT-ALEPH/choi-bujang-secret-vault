using System.Diagnostics;
using System.Net;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using System.Collections.Concurrent;
using Microsoft.Diagnostics.Tracing.Parsers;
using Microsoft.Diagnostics.Tracing.Session;

// Native ETW metadata only. No command line, packet body or file content collection.
internal static class Program {
  static readonly string Root=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"KeshevSecurity");
  static readonly JsonSerializerOptions Json=new(){PropertyNameCaseInsensitive=true};
  record Destination(string Address,int Port,string Protocol);
  record Policy(long ThresholdBytes,int MinConnections,int WindowSeconds,int BlockSeconds,List<Destination> TrustedDestinations,List<string>? TrustedServices=null);
  static readonly HashSet<string> ApprovedServices=["chatgpt.com","ab.chatgpt.com","auth.openai.com","api.openai.com"];
  static readonly ConcurrentDictionary<string,(DateTimeOffset At,IPAddress[] Addresses)> ServiceAddresses=new();
  static bool TrustedService(IPAddress ip,int port,Policy p)=>port==443&&(p.TrustedServices??[]).Any(h=>ApprovedServices.Contains(h)&&ServiceAddresses.TryGetValue(h,out var entry)&&DateTimeOffset.UtcNow-entry.At<TimeSpan.FromMinutes(5)&&entry.Addresses.Contains(ip));
  static void RefreshServices(Policy p)=>Task.WhenAll((p.TrustedServices??[]).Where(ApprovedServices.Contains).Select(async h=>{try{var addresses=await Dns.GetHostAddressesAsync(h).WaitAsync(TimeSpan.FromSeconds(3));ServiceAddresses[h]=(DateTimeOffset.UtcNow,addresses);}catch{}})).GetAwaiter().GetResult();
  record Bucket(long Second,long Bytes,long Sends,HashSet<string> Connections);
  record Candidate(string EventId,string Destination,int Port,string Protocol,long Bytes,int Connections,long Sends,string ObservedAt,int WindowSeconds,int PolicyRevision);
  record Receipt(string EventId,string RuleName,string Destination,int Port,string Protocol,string Command,bool EffectApplied,string At,string ExpiresAt);
  static Policy ReadPolicy()=>JsonSerializer.Deserialize<Policy>(File.ReadAllText(Path.Combine(Root,"policy.json")),Json)??throw new Exception("POLICY_REQUIRED");
  static readonly object Gate=new();
  static readonly Dictionary<string,Queue<Bucket>> Flows=new();
  static readonly Dictionary<string,DateTime> Emitted=new();
  static DateTime LastHeartbeat=DateTime.MinValue;
  static JsonElement NativeSnapshot;
  static string Hash(string x)=>Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(x))).ToLowerInvariant();
  static void Append(string file,object value){
    using var mutex=new Mutex(false,@"Global\Keshev.Egress.Ledger");if(!mutex.WaitOne(TimeSpan.FromSeconds(5)))throw new Exception("STORE_BUSY");
    try{var p=Path.Combine(Root,file);if(File.Exists(p)&&new FileInfo(p).Length>100_000_000){var prev=p+".1";File.Move(p,prev,true);}File.AppendAllText(p,JsonSerializer.Serialize(value)+"\n",new UTF8Encoding(false));}finally{mutex.ReleaseMutex();}
  }
  static List<T> Read<T>(string file){return new[]{file+".1",file}.Select(n=>Path.Combine(Root,n)).Where(File.Exists).SelectMany(File.ReadLines).Where(x=>!string.IsNullOrWhiteSpace(x)).Select(x=>JsonSerializer.Deserialize<T>(x,Json)??throw new Exception("STORE_INVALID")).ToList();}
  static bool Eligible(string address,int port,string protocol,Policy p)=>IPAddress.TryParse(address,out var ip)&&!IPAddress.IsLoopback(ip)&&!ip.Equals(IPAddress.Any)&&!ip.Equals(IPAddress.IPv6Any)
    &&port is >0 and <=65535&&protocol is "tcp" or "udp"&&!TrustedService(ip,port,p)&&!p.TrustedDestinations.Any(d=>d.Address==address&&(d.Port==0||d.Port==port)&&(d.Protocol=="any"||d.Protocol==protocol));
  static void Send(string address,int port,string protocol,int pid,int localPort,int size){
    if(size<=0||!IPAddress.TryParse(address,out var ip)||IPAddress.IsLoopback(ip))return;
    var second=DateTimeOffset.UtcNow.ToUnixTimeSeconds();var key=address+"|"+port+"|"+protocol;
    lock(Gate){
      if(!Flows.TryGetValue(key,out var q)){if(Flows.Count>=10000)return;Flows[key]=q=new();}
      if(q.Count>0&&q.Last().Second==second){var b=q.Last();b.Connections.Add(pid+":"+localPort);var items=q.ToArray();items[^1]=b with {Bytes=b.Bytes+size,Sends=b.Sends+1};Flows[key]=new Queue<Bucket>(items);}
      else q.Enqueue(new Bucket(second,size,1,[pid+":"+localPort]));
    }
  }
  static void Flush(Policy p){
    var now=DateTimeOffset.UtcNow;List<Candidate> output=[];
    lock(Gate){foreach(var pair in Flows.ToArray()){
      var q=pair.Value;while(q.Count>0&&q.Peek().Second<=now.ToUnixTimeSeconds()-p.WindowSeconds)q.Dequeue();if(q.Count==0){Flows.Remove(pair.Key);continue;}
      var k=pair.Key.Split('|');var total=q.Sum(b=>b.Bytes);var connections=q.SelectMany(b=>b.Connections).Distinct().Count();
      var c=new Candidate(Guid.NewGuid().ToString(),k[0],int.Parse(k[1]),k[2],total,connections,q.Sum(b=>b.Sends),now.ToString("O"),p.WindowSeconds,1);
      var candidate=total>=p.ThresholdBytes&&connections>=p.MinConnections&&Eligible(c.Destination,c.Port,c.Protocol,p);
      if(candidate&&(!Emitted.TryGetValue(pair.Key,out var previous)||DateTime.UtcNow-previous>TimeSpan.FromSeconds(p.BlockSeconds))){Emitted[pair.Key]=DateTime.UtcNow;Append("candidates.jsonl",c);output.Add(c);}
    }}
    foreach(var c in output)Append("network.jsonl",new {keshev=new {kind="egress_candidate",event_id=c.EventId,dstip=c.Destination,dstport=c.Port,protocol=c.Protocol,bytes=c.Bytes,count=c.Connections,sends=c.Sends,window_seconds=c.WindowSeconds,observed_at=c.ObservedAt,policy_revision=c.PolicyRevision}});
    Reconcile();
    if(DateTime.UtcNow-LastHeartbeat>TimeSpan.FromSeconds(15)){
      NativeSnapshot=ReadNativeStates();
      foreach(var r in Read<Receipt>("responses.jsonl").GroupBy(r=>r.RuleName).Select(g=>g.Last()).Where(r=>r.Command=="add"&&r.EffectApplied&&DateTimeOffset.Parse(r.ExpiresAt)>now)){
        if(!NativeSnapshot.EnumerateArray().Any(n=>n.GetProperty("rule_name").GetString()==r.RuleName&&n.GetProperty("blocked").GetBoolean()))Firewall(Find(r.EventId),true);
      }
      NativeSnapshot=ReadNativeStates();LastHeartbeat=DateTime.UtcNow;
      Append("network.jsonl",new {keshev=new {kind="endpoint_status",observed_at=now.ToString("O"),source="windows-etw",coverage="kernel-network-metadata",monitored_flows=Flows.Count,active_blocks=NativeSnapshot.EnumerateArray().Count(r=>r.GetProperty("blocked").GetBoolean()),trusted_services_ready=ServiceAddresses.Values.Count(s=>DateTimeOffset.UtcNow-s.At<TimeSpan.FromMinutes(5))}});
      foreach(var row in NativeSnapshot.EnumerateArray())Append("network.jsonl",new {keshev=new {kind="native_state",observed_at=now.ToString("O"),event_id=row.GetProperty("event_id").GetString(),rule_name=row.GetProperty("rule_name").GetString(),port=row.GetProperty("port").GetInt32(),protocol=row.GetProperty("protocol").GetString(),blocked=row.GetProperty("blocked").GetBoolean()}});
    }
    var state=new {schema="keshev.etw.status.v1",source="Windows ETW Kernel Network",observedAt=now.ToString("O"),monitoredFlows=Flows.Count,packetContents=false,blocks=NativeSnapshot,nativeObservedAt=LastHeartbeat.ToString("O"),policy=new {p.ThresholdBytes,p.MinConnections,p.WindowSeconds,p.BlockSeconds}};
    var temp=Path.Combine(Root,"sensor-status.tmp");File.WriteAllText(temp,JsonSerializer.Serialize(state));File.Move(temp,Path.Combine(Root,"sensor-status.json"),true);
  }
  static string Rule(Candidate c)=>"Keshev-Egress-"+Hash(c.Destination+"|"+c.Port+"|"+c.Protocol)[..24];
  static string Deadline(Receipt? previous,string id,DateTimeOffset now,int seconds)=>previous?.Command=="add"&&previous.EventId==id&&DateTimeOffset.Parse(previous.ExpiresAt)>now?previous.ExpiresAt:now.AddSeconds(seconds).ToString("O");
  static string PowerShell(string script){
    var start=new ProcessStartInfo("powershell.exe"){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
    foreach(var a in new[]{"-NoLogo","-NoProfile","-NonInteractive","-EncodedCommand",Convert.ToBase64String(Encoding.Unicode.GetBytes("$ErrorActionPreference='Stop';[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);"+script))})start.ArgumentList.Add(a);
    using var process=Process.Start(start)??throw new Exception("FIREWALL_UNAVAILABLE");
    var output=process.StandardOutput.ReadToEndAsync();var error=process.StandardError.ReadToEndAsync();
    if(!process.WaitForExit(15000)){process.Kill(true);throw new Exception("FIREWALL_TIMEOUT");}
    if(process.ExitCode!=0)throw new Exception("FIREWALL_UNVERIFIED");return output.GetAwaiter().GetResult();
  }
  const string QueryRule="function Test-OwnedRule($name,$address,$port,$protocol){$r=Get-NetFirewallRule -Name $name -ErrorAction SilentlyContinue;if(!$r){return $false};$a=@($r|Get-NetFirewallAddressFilter).RemoteAddress;$p=$r|Get-NetFirewallPortFilter;return ([string]$r.Enabled -eq 'True' -and [string]$r.Action -eq 'Block' -and [string]$r.Direction -eq 'Outbound' -and $r.Group -eq 'Keshev Egress' -and (@($a) -contains $address -or @($a) -contains ($address+'/32') -or @($a) -contains ($address+'/128')) -and @($p.RemotePort).Count -eq 1 -and [string]$p.RemotePort -eq [string]$port -and [string]$p.Protocol -in $(if($protocol -eq 'tcp'){@('6','TCP')}else{@('17','UDP')}))};";
  static JsonElement ReadNativeStates(){
    var commands=new StringBuilder(QueryRule+"$rows=@();");
    foreach(var r in Read<Receipt>("responses.jsonl").GroupBy(r=>r.RuleName).Select(g=>g.Last())){
      var c=Find(r.EventId);if(r.RuleName!=Rule(c))throw new Exception("RULE_OWNERSHIP_INVALID");
      commands.Append($"$rows+=@{{event_id='{c.EventId}';rule_name='{Rule(c)}';port={c.Port};protocol='{c.Protocol}';blocked=[bool](Test-OwnedRule '{Rule(c)}' '{c.Destination}' {c.Port} '{c.Protocol}')}};");
    }
    commands.Append("ConvertTo-Json -InputObject @($rows) -Compress");return JsonDocument.Parse(PowerShell(commands.ToString())).RootElement.Clone();
  }
  static bool Firewall(Candidate c,bool add){
    if(add&&!Eligible(c.Destination,c.Port,c.Protocol,ReadPolicy()))throw new Exception("TARGET_PROTECTED");
    var name=Rule(c);var ps=add?
      $"$r=Get-NetFirewallRule -Name '{name}' -ErrorAction SilentlyContinue;if(!$r){{New-NetFirewallRule -Name '{name}' -DisplayName '{name}' -Group 'Keshev Egress' -Direction Outbound -Action Block -Enabled True -Profile Any -Protocol {c.Protocol.ToUpperInvariant()} -RemoteAddress '{c.Destination}' -RemotePort {c.Port}|Out-Null}};if(!(Test-OwnedRule '{name}' '{c.Destination}' {c.Port} '{c.Protocol}')){{exit 3}}":
      $"Get-NetFirewallRule -Name '{name}' -ErrorAction SilentlyContinue|Remove-NetFirewallRule; if(Get-NetFirewallRule -Name '{name}' -ErrorAction SilentlyContinue){{exit 3}}";
    PowerShell(QueryRule+ps);return true;
  }
  static void Reconcile(){
    var p=ReadPolicy();var last=Read<Receipt>("responses.jsonl").GroupBy(x=>x.RuleName).Select(g=>g.Last()).Where(r=>r.Command=="add"&&(DateTimeOffset.Parse(r.ExpiresAt)<=DateTimeOffset.UtcNow||TrustedService(IPAddress.Parse(r.Destination),r.Port,p)));
    foreach(var r in last.ToArray()){var c=Read<Candidate>("candidates.jsonl").First(x=>x.EventId==r.EventId);Firewall(c,false);SaveReceipt(c,"delete",true);}
  }
  static void SaveReceipt(Candidate c,string command,bool applied,string? deadline=null){var now=DateTimeOffset.UtcNow;Append("responses.jsonl",new Receipt(c.EventId,Rule(c),c.Destination,c.Port,c.Protocol,command,applied,now.ToString("O"),deadline??now.AddSeconds(ReadPolicy().BlockSeconds).ToString("O")));}
  static Candidate Find(string id)=>Guid.TryParse(id,out _)?Read<Candidate>("candidates.jsonl").FirstOrDefault(c=>c.EventId==id)??throw new Exception("EVIDENCE_NOT_FOUND"):throw new Exception("EVIDENCE_INVALID");
  static void Response(){
    var line=Console.ReadLine();if(line==null||line.Length>262144)throw new Exception("INPUT_INVALID");using var d=JsonDocument.Parse(line);var r=d.RootElement;var command=r.GetProperty("command").GetString();
    if(command is not("add" or "delete"))throw new Exception("COMMAND_INVALID");var alert=r.GetProperty("parameters").GetProperty("alert");
    if(alert.GetProperty("rule").GetProperty("id").GetString()!="100121")throw new Exception("RULE_INVALID");var k=alert.GetProperty("data").GetProperty("keshev");var c=Find(k.GetProperty("event_id").GetString()!);var p=ReadPolicy();
    if(c.Bytes<p.ThresholdBytes||c.Connections<p.MinConnections||!Eligible(c.Destination,c.Port,c.Protocol,p))throw new Exception("EVIDENCE_INSUFFICIENT");
    // Wazuh also sends delete while stopping. Keep the owned deadline across restarts.
    var previous=Read<Receipt>("responses.jsonl").LastOrDefault(x=>x.RuleName==Rule(c));
    if(command=="delete"&&previous?.Command=="add"&&DateTimeOffset.Parse(previous.ExpiresAt)>DateTimeOffset.UtcNow)return;
    if(command=="add"){
      if(DateTimeOffset.UtcNow-DateTimeOffset.Parse(c.ObservedAt)>TimeSpan.FromSeconds(p.WindowSeconds+30))throw new Exception("EVIDENCE_STALE");
      Console.WriteLine(JsonSerializer.Serialize(new{version=1,origin=new{name="keshev-egress",module="active-response"},command="check_keys",parameters=new{keys=new[]{Rule(c)}}}));Console.Out.Flush();
      using var answer=JsonDocument.Parse(Console.ReadLine()??throw new Exception("CHECK_REQUIRED"));if(answer.RootElement.GetProperty("command").GetString()!="continue")return;
    }
    var deadline=Deadline(previous,c.EventId,DateTimeOffset.UtcNow,p.BlockSeconds);
    if(command=="add")SaveReceipt(c,command,false,deadline);
    Firewall(c,command=="add");SaveReceipt(c,command!,true,deadline);
  }
  static int Main(string[] args){try{
    if(args.Contains("--self-test")){var p=new Policy(50_000_000,5,120,900,[new("127.0.0.1",0,"any")]);if(Eligible("127.0.0.1",80,"tcp",p)||Eligible("bad",80,"tcp",p)||!Eligible("192.0.2.25",58443,"tcp",p))throw new Exception("SELF_TEST_FAILED");var now=DateTimeOffset.UtcNow;var r=new Receipt("event","owned","192.0.2.25",58443,"tcp","add",true,now.ToString("O"),now.AddMinutes(5).ToString("O"));if(Deadline(r,"event",now,900)!=r.ExpiresAt||Deadline(r,"different",now,900)==r.ExpiresAt)throw new Exception("DEADLINE_TEST_FAILED");Console.WriteLine("validated-target-policy-and-deadline-check passed");return 0;}
    if(!OperatingSystem.IsWindows()||!new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator))throw new Exception("ADMINISTRATOR_REQUIRED");
    Directory.CreateDirectory(Root);
    RefreshServices(ReadPolicy());
    if(Path.GetFileNameWithoutExtension(Environment.ProcessPath)?.Equals("keshev-egress",StringComparison.OrdinalIgnoreCase)==true||args.FirstOrDefault()=="response"){Response();return 0;}
    if(args.FirstOrDefault()=="recover"){var c=Find(args.ElementAtOrDefault(1)??"");var latest=Read<Receipt>("responses.jsonl").LastOrDefault(r=>r.RuleName==Rule(c));if(latest?.EventId!=c.EventId)throw new Exception("RESPONSE_SUPERSEDED");Firewall(c,false);SaveReceipt(c,"delete",true);Console.WriteLine("recovery-effect-verified");return 0;}
    using var singleton=new Mutex(true,@"Global\Keshev.Egress.Sensor",out var created);if(!created)throw new Exception("SENSOR_ALREADY_RUNNING");
    var policy=ReadPolicy();Reconcile();using var session=new TraceEventSession("Keshev-Egress-Network"){StopOnDispose=true};
    session.EnableKernelProvider(KernelTraceEventParser.Keywords.NetworkTCPIP);
    session.Source.Kernel.TcpIpSend+=e=>Send(e.daddr.ToString(),e.dport,"tcp",e.ProcessID,e.sport,e.size);
    session.Source.Kernel.TcpIpSendIPV6+=e=>Send(e.daddr.ToString(),e.dport,"tcp",e.ProcessID,e.sport,e.size);
    session.Source.Kernel.UdpIpSend+=e=>Send(e.daddr.ToString(),e.dport,"udp",e.ProcessID,e.sport,e.size);
    session.Source.Kernel.UdpIpSendIPV6+=e=>Send(e.daddr.ToString(),e.dport,"udp",e.ProcessID,e.sport,e.size);
    var flushing=0;using var serviceTimer=new Timer(_=>RefreshServices(policy),null,60000,60000);
    using var timer=new Timer(_=>{if(Interlocked.Exchange(ref flushing,1)!=0)return;try{Flush(policy);}catch{Append("health.jsonl",new{at=DateTimeOffset.UtcNow.ToString("O"),status="unavailable",code="OBSERVATION_OR_RECONCILIATION_FAILED"});}finally{Interlocked.Exchange(ref flushing,0);}},null,1000,5000);
    Console.CancelKeyPress+=(_,e)=>{e.Cancel=true;session.Source.StopProcessing();};session.Source.Process();return 0;
  }catch(Exception e){Console.Error.WriteLine(e.Message is "ADMINISTRATOR_REQUIRED" or "SENSOR_ALREADY_RUNNING"?e.Message:$"PC_SECURITY_OPERATION_FAILED {e.GetType().Name} 0x{e.HResult:x8}");if(args.FirstOrDefault()=="sensor")Console.Error.WriteLine(e.Message);return 1;}}
}
