param([ValidateSet('network','firewall','events')][string]$Kind)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
# Local read-only queries only. Never return addresses, account names or event text.
try {
  switch ($Kind) {
    'network' {
      $rows=@(Get-NetIPConfiguration -All | ForEach-Object {
        $state=[string]$_.NetAdapter.Status
        if ($state -notin @('Up','Down','Disconnected','Disabled','Not Present','Unknown','Dormant','LowerLayerDown')) {$state='Unknown'}
        [pscustomobject]@{state=$state;ipv4Configured=(@($_.IPv4Address | Where-Object { $null -ne $_ }).Count -gt 0);ipv6Configured=(@($_.IPv6Address | Where-Object { $null -ne $_ }).Count -gt 0);defaultRouteConfigured=(@($_.IPv4DefaultGateway | Where-Object { $null -ne $_ }).Count -gt 0 -or @($_.IPv6DefaultGateway | Where-Object { $null -ne $_ }).Count -gt 0);dnsConfigured=(@($_.DNSServer.ServerAddresses | Where-Object { $null -ne $_ }).Count -gt 0)}
      })
      $data=@{interfaces=$rows}
    }
    'firewall' {
      $rows=@(Get-NetFirewallProfile -PolicyStore ActiveStore | ForEach-Object {
        $enabled=switch ([string]$_.Enabled) {'True' {'on'} 'False' {'off'} default {'unknown'}}
        if ([string]$_.Name -notin @('Domain','Private','Public')) {throw 'UNEXPECTED_PROFILE'}
        [pscustomobject]@{profile=[string]$_.Name;enabled=$enabled}
      })
      if ($rows.Count -ne 3) {throw 'INCOMPLETE_PROFILES'}
      $data=@{profiles=$rows}
    }
    'events' {
      $end=Get-Date;$start=$end.AddHours(-24)
      $rows=@(foreach ($log in @('System','Application')) {
        try {
          # The 10001st result means the total is unknown; never label a capped count as complete.
          $events=@(Get-WinEvent -FilterHashtable @{LogName=$log;Level=2,3;StartTime=$start;EndTime=$end} -MaxEvents 10001)
          if ($events.Count -ge 10001) {throw 'EVENT_COUNT_LIMIT'}
          [pscustomobject]@{log=$log;status='measured';warnings=@($events | Where-Object Level -eq 3).Count;errors=@($events | Where-Object Level -eq 2).Count;code=$null}
        } catch {
          if ($_.FullyQualifiedErrorId -like 'NoMatchingEventsFound*') {
            [pscustomobject]@{log=$log;status='measured';warnings=0;errors=0;code=$null}
          } else {
            [pscustomobject]@{log=$log;status='unavailable';warnings=$null;errors=$null;code='LOG_READ_UNAVAILABLE'}
          }
        }
      })
      $data=@{startAt=$start.ToUniversalTime().ToString('o');endAt=$end.ToUniversalTime().ToString('o');logs=$rows}
    }
  }
  @{status='measured';observedAt=(Get-Date).ToUniversalTime().ToString('o');data=$data} | ConvertTo-Json -Depth 6 -Compress
} catch {
  @{status='unavailable';observedAt=(Get-Date).ToUniversalTime().ToString('o');code='WINDOWS_READ_UNAVAILABLE';data=$null} | ConvertTo-Json -Compress
}
