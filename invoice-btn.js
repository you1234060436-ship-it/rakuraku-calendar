(function(){
if(document.getElementById('nichilogInvoiceBtn'))return;
var btn=document.createElement('button');
btn.id='nichilogInvoiceBtn';
btn.innerHTML='\uD83D\uDCC4 請求書・領収書';
btn.style.cssText='position:fixed;bottom:20px;right:20px;z-index:99999;background:#1a73e8;color:#fff;border:none;border-radius:50px;padding:14px 20px;font-size:15px;font-weight:bold;font-family:sans-serif;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:transform 0.2s;';
btn.onmouseover=function(){this.style.transform='scale(1.05)'};
btn.onmouseout=function(){this.style.transform='scale(1)'};
btn.onclick=async function(){
  try{
    btn.disabled=true;btn.textContent='読込中...';
    var SUPABASE_URL='https://hjmtsuxrwypimscyviey.supabase.co';
    var SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqbXRzdXhyd3lwaW1zY3l2aWV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgzMjc2MjAsImV4cCI6MjA1MzkwMzYyMH0.rpcQSrNMGbbow6VCEhxVMVGj0RxJNP9bOaOXB_5cYQo';
    var headers={'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY,'Content-Type':'application/json'};
    var companyId=localStorage.getItem('selectedCompanyId')||'';
    var data={};
    if(companyId){
      var cRes=await fetch(SUPABASE_URL+'/rest/v1/companies?id=eq.'+companyId+'&select=name',{headers:headers});
      var companies=await cRes.json();
      if(companies&&companies[0])data.issuerCompany=companies[0].name;
      var sRes=await fetch(SUPABASE_URL+'/rest/v1/company_settings?company_id=eq.'+companyId+'&select=settings',{headers:headers});
      var settings=await sRes.json();
      if(settings&&settings[0]&&settings[0].settings){
        var s=settings[0].settings;
        if(s.address)data.issuerAddr=s.address;
        if(s.tel)data.issuerTel=s.tel;
        if(s.fax)data.issuerFax=s.fax;
        if(s.regNo)data.issuerRegNo=s.regNo;
        if(s.bankName)data.bankName=s.bankName;
        if(s.bankBranch)data.bankBranch=s.bankBranch;
        if(s.bankType)data.bankType=s.bankType;
        if(s.bankNo)data.bankNo=s.bankNo;
        if(s.bankHolder)data.bankHolder=s.bankHolder;
      }
    }
    localStorage.setItem('nichilog_invoice_data',JSON.stringify(data));
    window.location.href='invoice.html';
  }catch(e){
    alert('データ取得エラー: '+e.message);
    btn.disabled=false;btn.innerHTML='\uD83D\uDCC4 請求書・領収書';
  }
};
document.body.appendChild(btn);
})();
