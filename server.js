
const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit: "5kb" }));

const sessions = new Map();
const PORTALS_API = "https://portal-market.com/partners";

app.get("/", (req, res) => {
  res.send(page);
});

app.post("/api/connect", async (req, res) => {
  const apiKey = String(req.body.apiKey || "").trim();

  if (!apiKey || apiKey.length > 500) {
    return res.status(400).json({
      error: "Введите API-ключ"
    });
  }

  try {
    const response = await fetch(
      `${PORTALS_API}/collections/preview`,
      {
        headers: {
          Authorization: `partners ${apiKey}`,
          Accept: "application/json"
        },
        signal: AbortSignal.timeout(15000)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data.code === "PARTNER_SUBSCRIPTION_REQUIRED"
            ? "Не выбран тариф Partner API"
            : data.code === "PARTNER_INVALID_KEY"
            ? "Неверный API-ключ"
            : data.message || "Ошибка авторизации"
      });
    }

    const session = crypto.randomBytes(32).toString("hex");

    sessions.set(session, {
      apiKey,
      createdAt: Date.now()
    });

    res.setHeader(
      "Set-Cookie",
      `liquidity_session=${session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200`
    );

    res.json({
      success: true,
      message: "API-ключ успешно проверен"
    });

  } catch (error) {
    res.status(502).json({
      error: "Portals API временно недоступен"
    });
  }
});

app.get("/api/status", (req, res) => {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/liquidity_session=([^;]+)/);

  const connected = match && sessions.has(match[1]);

  res.json({ connected: !!connected });
});

const page = `
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Liquidity Access</title>
<style>
*{box-sizing:border-box}
body{
 margin:0;min-height:100vh;display:flex;
 justify-content:center;align-items:center;
 background:radial-gradient(circle,#102b1e,#050807 70%);
 color:white;font-family:Arial
}
.panel{
 width:90%;max-width:410px;padding:35px 25px;
 background:#0c1410;border:1px solid #185238;
 border-radius:20px;text-align:center;
 box-shadow:0 0 35px #00ff7720
}
.logo{font-size:28px;font-weight:bold;
 letter-spacing:4px;color:#00f58b}
h2{margin-top:35px}
p{color:#91a398;font-size:14px;line-height:1.6}
input{
 width:100%;padding:15px;margin:15px 0;
 background:#07100b;border:1px solid #28543a;
 border-radius:9px;color:white
}
button{
 width:100%;padding:16px;border:0;
 border-radius:9px;background:#00e879;
 font-weight:bold;cursor:pointer;margin-top:10px
}
.secondary{background:#17271e;color:white}
.status{padding:15px;background:#102219;
 border-radius:10px;margin:20px 0;color:#00ed86}
#error{color:#ff7777}
#success{color:#00ed86}
.hidden{display:none}
</style>
</head>
<body>
<div class="panel">
 <div class="logo">LIQUIDITY</div>
 <h2>Проверка ликвидности</h2>
 <p>Подключите свой Portals Partner API.</p>

 <button onclick="window.open(
 'https://t.me/portals/market?startapp=to_partnerapi',
 '_blank'
 )">ПОЛУЧИТЬ API-КЛЮЧ</button>

 <input id="key" type="password"
 placeholder="Вставьте API-ключ">

 <button id="connect" onclick="connect()">
 ВОЙТИ
 </button>

 <div id="error"></div>
 <div id="success"></div>

 <div id="connected" class="hidden">
   <div class="status">
     ● PORTALS УСПЕШНО ПОДКЛЮЧЁН
   </div>
 </div>
</div>

<script>
async function connect(){
 const key=document.getElementById("key").value.trim();
 const error=document.getElementById("error");
 const success=document.getElementById("success");
 const button=document.getElementById("connect");

 error.textContent="";
 success.textContent="";

 if(!key){
   error.textContent="Введите API-ключ";
   return;
 }

 button.disabled=true;
 button.textContent="ПРОВЕРКА...";

 try{
   const response=await fetch("/api/connect",{
     method:"POST",
     headers:{"Content-Type":"application/json"},
     body:JSON.stringify({apiKey:key})
   });

   const data=await response.json();

   if(!response.ok) throw new Error(data.error);

   document.getElementById("key").value="";
   document.getElementById("connected")
     .classList.remove("hidden");

   success.textContent="Авторизация успешна!";

 }catch(e){
   error.textContent=e.message;
 }finally{
   button.disabled=false;
   button.textContent="ВОЙТИ";
 }
}
</script>
</body>
</html>
`;

app.listen(PORT, () => {
  console.log("Liquidity website started on port " + PORT);
});
