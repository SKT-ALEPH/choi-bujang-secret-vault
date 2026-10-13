// Independent offline rules; names and conditions mirror patterns.json.
const PATTERNS=Object.freeze({
  anomalous_bulk_transfer:'대용량·대량 반출과 낯선 목적지/반복/시간밖/이상포트의 결합',
  possible_exfiltration:'단발·소량·실패·압축 생성만의 불확실한 반출 징후',
  normal_activity:'유출 근거 없는 정상 조회·저장·동기화',
});
export function decide(alert){
  const raw=alert?.rule!==undefined||alert?.data!==undefined;
  const d=String((raw?alert?.rule?.description:alert?.description)??'').slice(0,2000);
  const level=Number(raw?alert?.rule?.level:alert?.level);
  const data=raw&&alert?.data&&typeof alert.data==='object'?alert.data:{};
  const number=k=>{const n=Number(data[k]);return Number.isFinite(n)&&n>=0?n:0;};
  const bytes=number('bytes'),files=number('files'),count=number('count');
  const novel=/처음\s*(?:보는|봅)|평소와\s*다른\s*주소|외부\s*주소/u.test(d);
  const offHours=/(?:업무|수업)\s*시간\s*밖/u.test(d);
  const unusualPort=/평소.*쓰지\s*않던\s*포트|비정상\s*포트/u.test(d);
  const repeated=count>=5||/(?:[5-9]|[1-9]\d+)번|반복\s*전송/u.test(d);
  const describedFiles=Number(/자료\s*(\d+)건/u.exec(d)?.[1]??0);
  const bulk=bytes>=50000000||files>=50||describedFiles>=100||/대용량|큰\s*파일|자료실\s*전체|메모\s*묶음/u.test(d);
  const transferred=/전송|나갔|올라갔|복사됐|반출/u.test(d);
  const incomplete=/전송은\s*아직\s*없|외부\s*전송은\s*아직\s*없|전송.*실패|큰\s*파일은\s*아닙/u.test(d);
  let confidence=.1,name='normal_activity';
  if(transferred&&bulk&&(novel||offHours||unusualPort||repeated)&&!incomplete){confidence=.96;name='anomalous_bulk_transfer';}
  else if(level>=5&&/전송|나갔|올라갔|목적지|압축\s*파일|반출|명령\s*통로/u.test(d)){confidence=.6;name='possible_exfiltration';}
  return{action:confidence>=.85?'block':confidence>=.5?'alert':'record',confidence,reason:name+': '+PATTERNS[name]};
}
