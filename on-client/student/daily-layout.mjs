// Development UI only. Provided source files remain unchanged.
const status=document.querySelector('#student-status')?.closest('.card');
const identity=document.querySelector('#student-identity')?.closest('.card');
const view=document.querySelector('#view-protection');
if(status&&identity&&view){
  view.insertBefore(status,identity);
  document.querySelector('#student-status-title').textContent='내 PC 대시보드 · 학생 개발 기능';
  const details=document.createElement('details'),summary=document.createElement('summary');
  details.className='secondary-tools';summary.textContent='기존 계정·기기 연결 정보';
  identity.before(details);details.append(summary,identity);
  const errors=document.querySelector('#error-message');
  if(errors){const wrapper=document.createElement('details'),label=document.createElement('summary');wrapper.className='secondary-tools';label.textContent='기존 서버 연결 오류 · PC 실측과 별도';status.after(wrapper);wrapper.append(label,errors);}
}
