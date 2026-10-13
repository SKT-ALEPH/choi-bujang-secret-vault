// Independent offline rules; names and conditions mirror patterns.json.
const PATTERNS = Object.freeze({
  untrusted_persistence: '서비스·예약·시작 항목과 서명 부재·임시 실행·미등록 변경의 결합',
  possible_persistence: '지속성 관련 변경이나 미확인 서명은 알림만',
  normal_activity: '새로운 지속성 공격 근거 없는 정상 활동',
});
export function decide(alert) {
  const raw=alert?.rule!==undefined||alert?.data!==undefined;
  const description=String((raw?alert?.rule?.description:alert?.description)??'').slice(0,2000);
  const level=Number(raw?alert?.rule?.level:alert?.level);
  const path=raw&&typeof alert?.data?.path==='string'?alert.data.path.slice(0,2000):'';
  const event=/서비스|예약\s*작업|시작\s*(?:폴더|프로그램|항목)|service|scheduled\s*task|startup/iu.test(description);
  const unsigned=/서명\s*(?:없는|이\s*없|없)|unsigned/iu.test(description);
  const temporary=/임시\s*(?:폴더|파일)|[\\/]temp[\\/]/iu.test(description+' '+path);
  const unknown=/평소\s*목록에\s*없|처음\s*보는|임의\s*문자열|unrecognized|not\s*in\s*baseline/iu.test(description);
  const changed=/추가|등록|바뀌|변경|가리|실행|함께|남도록|created|installed|modified/iu.test(description);
  const benign=/등록은\s*없|실행\s*파일은\s*그대로|설명만|읽기만|기존.*서명된|기존.*마쳤|평소.*그대로|같은\s*파일로/iu.test(description);
  let confidence=.1,name='normal_activity';
  if(event&&changed&&!benign&&(unsigned||temporary||unknown)) { confidence=.95;name='untrusted_persistence'; }
  else if(level>=5&&(event||temporary)) { confidence=.6;name='possible_persistence'; }
  return {action:confidence>=.85?'block':confidence>=.5?'alert':'record',confidence,reason:name+': '+PATTERNS[name]};
}
