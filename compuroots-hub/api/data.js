// Vercel serverless function: shared data for the whole team (Upstash Redis via REST)
const DB_URL=process.env.KV_REST_API_URL||process.env.UPSTASH_REDIS_REST_URL;
const DB_TOKEN=process.env.KV_REST_API_TOKEN||process.env.UPSTASH_REDIS_REST_TOKEN;
const PASS=process.env.TEAM_PASSWORD||"";
const KEY="compuroots_hub_data";
const DEF_T=[
 {t:"Intro",tag:"General",s:"Quotation - [Customer]",b:"Dear [Name],\n\nI hope this mail finds you well.\n\n[Message]"},
 {t:"QNAP Price",tag:"QNAP",s:"Request for QNAP Storage Price",b:"Dear [Name],\nGood Day,\n\nAs per our conversation, kindly support the below requirements with QTY [QTY]:\n\nChassis: [ ]\nWorkload & Capacity: [ ]\nAvailability: [ ]\nNetwork: [ ]"},
 {t:"VMware Renewal",tag:"VMware",s:"Renewal VMware - [EUD]",b:"Dear [Name],\nGood Day,\n\nKindly support with the below required for the below EUD:\n\n\"One Year Renewal for VMware vSphere Foundation 568 Core.\"\n\nFor the below EUD:\n[EUD]"},
 {t:"Share EUD",tag:"General",s:"Request for EUD details",b:"Dear [Name],\nGood Day,\n\nKindly share the EUD for this customer."},
 {t:"Extended Warranty",tag:"Servers",s:"Extended Warranty Request - [Customer]",b:"Dear [Name],\nGood Day,\n\nKindly support with the below:\n\n\"We need extended one year warranty for the devices below:\"\n\n[Devices / Serial numbers]"},
 {t:"Request Price",tag:"General",s:"Request for Price - [Customer]",b:"Dear [Name],\n\nGood Day,\n\nKindly provide me with the price for the below items with QTY:-\n\n[Items]"},
 {t:"Reminder",tag:"General",s:"Reminder - [Subject]",b:"Dear [Name],\n\nI hope you're doing well.\n\nAny updates for the below?"}
];
const DEF_C=[
 {cat:"Veeam",co:"Redington",name:"Mohamed Fawzy",email:"Mohamed.Fawzy@redingtongroup.com"},
 {cat:"QNAP",co:"Easy Technology Solutions",name:"Aly Mohamed",email:"aly.mohamed@ets.com.eg"},
 {cat:"Microsoft License",co:"Klay Tech",name:"Ganna Ahmed",email:"gahmed@klayytech.com"},
 {cat:"Microsoft License",co:"Klay Tech",name:"Marwan Elgohary",email:"melgohary@klayytech.com"},
 {cat:"Microsoft License",co:"Klay Tech",name:"Rasha Mohamed",email:"rmohamed@klayytech.com"},
 {cat:"VMware",co:"VAS",name:"Abdelwahab Khaled",email:"Abdelwahab.Khaled@vas-eg.net"},
 {cat:"VMware",co:"VAS",name:"Asmaa Fouad",email:"asmaa.fouad@vas-eg.net"},
 {cat:"Servers",co:"Resellers",name:"Mohamed Abd Al-Fattah",email:"mohamed@iteglab.com"},
 {cat:"Servers",co:"Mini Disti",name:"Amr Medhat",email:"amr.medhat@mini-disti.com"},
 {cat:"Servers",co:"Aptec",name:"Sally El-Saadany",email:"Sally.El-Saadany@ingrammicro.com"},
 {cat:"Servers",co:"Mantrac",name:"Dina",email:"DSayed@mantracegypt.com"},
 {cat:"Servers",co:"Mantrac - Renewal Support Dell",name:"Hesham Ahmed Bassiouny",email:"HBassiouny@mantracegypt.com"},
 {cat:"Servers",co:"Mantrac - Renewal Support Dell",name:"Mahmoud Eid Mohamed Youssef",email:"MEMohamed@mantracegypt.com"},
 {cat:"Servers",co:"PCS",name:"Ramy Bekhet",email:"ramy.bekhet@pcs-comp.com"},
 {cat:"Servers",co:"Grand Computers",name:"Mahmoud",email:"m.shabaan@grand-computer.com",phone:"0106 163 3609"}
];
const rid=()=>Math.random().toString(36).slice(2,10);
const str=(v,n)=>String(v==null?"":v).slice(0,n);
function clean(kind,x){x=x||{};
  if(kind==="contact"){const o={cat:str(x.cat,80),co:str(x.co,120),name:str(x.name,120),email:str(x.email,160)};if(x.phone)o.phone=str(x.phone,40);return o}
  return {t:str(x.t,80),tag:str(x.tag,40)||"General",s:str(x.s,200),b:str(x.b,8000)}}
async function redis(cmd){
  const r=await fetch(DB_URL,{method:"POST",headers:{Authorization:"Bearer "+DB_TOKEN},body:JSON.stringify(cmd)});
  const j=await r.json();if(j.error)throw new Error(j.error);return j.result}
async function read(){
  const v=await redis(["GET",KEY]);if(v)return JSON.parse(v);
  const d={contacts:DEF_C.map(x=>({id:rid(),...x})),templates:DEF_T.map(x=>({id:rid(),...x}))};
  await redis(["SET",KEY,JSON.stringify(d)]);return d}
module.exports=async(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  // Diagnostic: open /api/data?check=1 in the browser. Shows only yes/no flags, no secrets, no data.
  if(req.query&&req.query.check!==undefined){
    const out={hasDbUrl:!!DB_URL,hasDbToken:!!DB_TOKEN,passwordIsSet:!!PASS};
    try{out.redisPing=await redis(["PING"])}catch(e){out.redisPing="FAIL: "+e.message}
    return res.status(200).json(out);
  }
  // Password is optional: if TEAM_PASSWORD is not set in Vercel, the page is open to anyone with the link.
  if(PASS&&req.headers["x-team-key"]!==PASS)return res.status(401).json({error:"auth"});
  try{
    const d=await read();
    if(req.method==="POST"){
      const {op,kind,id,item}=req.body||{};
      if(op==="replace"){
        d.contacts=(item.contacts||[]).map(x=>({...clean("contact",x),id:x.id||rid()}));
        d.templates=(item.templates||[]).map(x=>({...clean("template",x),id:x.id||rid()}));
      }else{
        const list=kind==="contact"?d.contacts:d.templates;
        const i=list.findIndex(x=>x.id===id);
        if(op==="add")list.push({...clean(kind,item),id:rid()});
        else if(op==="update"&&i>=0)list[i]={...clean(kind,item),id};
        else if(op==="delete"&&i>=0)list.splice(i,1);
      }
      await redis(["SET",KEY,JSON.stringify(d)]);
    }
    res.status(200).json(d);
  }catch(e){res.status(500).json({error:"server",detail:String(e&&e.message||e).slice(0,200)})}
};
