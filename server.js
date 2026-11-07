
const express = require("express");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const PORTALS_API = "https://portal-market.com/partners";

app.use(express.json({ limit: "5kb" }));

// Временное хранилище сессий
const sessions = new Map();

function getSession(req) {
  const cookies = req.headers.cookie || "";
  const match = cookies.match(/liquidity_session=([^;]+)/);

  if (!match) return null;

  return sessions.get(match[1]) || null;
}

// Главная страница
app.get("/", (req, res) => {
  res.send(page);
});

// Проверка API-ключа Portals
app.post("/api/connect", async (req, res) => {
  const apiKey = String(req.body?.apiKey || "").trim();

  if (!apiKey || apiKey.length > 500 || /[\r\n]/.test(apiKey)) {
    return res.status(400).json({
      error: "Введите корректный API-ключ"
    });
  }

  try {
    const response = await fetch(
      `${PORTALS_API}/collections/preview`,
      {
        method: "GET",
        headers: {
          Authorization: `partners ${apiKey}`,
          Accept: "application/json"
        },
        signal: AbortSignal.timeout(15000)
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      let message = "Ошибка проверки API-ключа";

      if (response.status === 401) {
        message = "Неверный API-ключ";
      } else if (response.status === 403) {
        message = "Доступ запрещён";
      } else if (response.status === 429) {
        message = "Слишком много запросов. Попробуйте позже";
      } else if (
        data.code === "PARTNER_SUBSCRIPTION_REQUIRED"
      ) {
        message = "Не выбран тариф Partner API";
      }

      return res.status(response.status).json({
        error: message
      });
    }

    // Создание сессии
    const sessionId = crypto.randomBytes(32).toString("hex");

    sessions.set(sessionId, {
      apiKey,
      createdAt: Date.now()
    });

    // Cookie для защищённой сессии
    res.cookie("liquidity_session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 12 * 60 * 60 * 1000,
      path: "/"
    });

    res.json({
      success: true,
      message: "Portals успешно подключён"
    });

  } catch (error) {
    console.error("Portals connection error:", error.message);

    res.status(502).json({
      error: "Не удалось связаться с Portals API"
    });
  }
});

// Проверка статуса подключения
app.get("/api/status", (req, res) => {
  const session = getSession(req);

  res.json({
    connected: !!session
  });
});

// Выход из аккаунта
app.post("/api/logout", (req, res) => {
  const cookies = req.headers.cookie || "";
  const match = cookies.match(/liquidity_session=([^;]+)/);

  if (match) {
    sessions.delete(match[1]);
  }

  res.clearCookie("liquidity_session", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });

  res.json({ success: true });
});

// Защищённая главная страница
const page = `
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Liquidity | Portals Market</title>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at center, #102b1e, #050807 70%);
  color: white;
  font-family: Arial, sans-serif;
  padding: 20px;
}

.panel {
  width: 100%;
  max-width: 420px;
  padding: 35px 25px;
  background: #0c1410;
  border: 1px solid #185238;
  border-radius: 20px;
  text-align: center;
  box-shadow: 0 0 40px #00ff7720;
}

.logo {
  font-size: 29px;
  font-weight: bold;
  letter-spacing: 5px;
  color: #00f58b;
}

.subtitle {
  font-size: 11px;
  color: #688174;
  letter-spacing: 3px;
  margin-top: 8px;
}

h2 {
  margin-top: 35px;
  font-size: 23px;
}

p {
  color: #91a398;
  font-size: 14px;
  line-height: 1.6;
}

input {
  width: 100%;
  padding: 16px;
  margin-top: 20px;
  background: #07100b;
  border: 1px solid #28543a;
  border-radius: 10px;
  color: white;
  outline: none;
}

input:focus {
  border-color: #00ed86;
}

button {
  width: 100%;
  padding: 16px;
  border: none;
  border-radius: 10px;
  background: #00e879;
  color: #031008;
  font-weight: bold;
  font-size: 14px;
  cursor: pointer;
  margin-top: 13px;
}

button:hover {
  background: #00ff91;
}

button:disabled {
  opacity: .5;
  cursor: wait;
}

.secondary {
  background: #17271e;
  color: white;
  border: 1px solid #28543a;
}

.status {
  padding: 17px;
  margin: 22px 0;
  border: 1px solid #185c3a;
  background: #102219;
  border-radius: 10px;
  color: #00ed86;
}

.error {
  color: #ff7777;
  margin-top: 15px;
  font-size: 13px;
}

.success {
  color: #00ed86;
  margin-top: 15px;
  font-size: 13px;
}

.hidden {
  display: none !important;
}

.footer {
  margin-top: 30px;
  font-size: 10px;
  color: #506158;
  letter-spacing: 2px;
}
</style>
</head>

<body>

<div class="panel">

  <div class="logo">LIQUIDITY</div>
  <div class="subtitle">PORTALS MARKET ACCESS</div>

  <div id="login">

    <h2>Проверка ликвидности</h2>

    <p>
      Подключите Portals Market,
      чтобы продолжить.
    </p>

    <div class="status">
      ● Ожидание авторизации
    </div>

    <button onclick="openPortals()">
      ПОЛУЧИТЬ API-КЛЮЧ
    </button>

    <input
      id="apiKey"
      type="password"
      placeholder="Вставьте API-ключ Portals"
      autocomplete="off"
    >

    <button id="connectButton" onclick="connect()">
      ВОЙТИ
    </button>

    <div id="error" class="error"></div>

  </div>

  <div id="dashboard" class="hidden">

    <h2>Доступ разрешён</h2>

    <div class="status">
      ● PORTALS ПОДКЛЮЧЁН
    </div>

    <p>
      Ваш API-ключ успешно проверен.
    </p>

    <button class="secondary" onclick="logout()">
      ВЫЙТИ
    </button>

  </div>

  <div class="footer">
    SECURE PORTALS ACCESS
  </div>

</div>

<script>

function openPortals() {
  window.open(
    "https://t.me/portals/market?startapp=to_partnerapi",
    "_blank"
  );
}

async function connect() {

  const key = document.getElementById("apiKey").value.trim();
  const error = document.getElementById("error");
  const button = document.getElementById("connectButton");

  error.textContent = "";

  if (!key) {
    error.textContent = "Введите API-ключ";
    return;
  }

  button.disabled = true;
  button.textContent = "ПРОВЕРКА...";

  try {

    const response = await fetch("/api/connect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        apiKey: key
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Ошибка авторизации");
    }

    document.getElementById("apiKey").value = "";

    document.getElementById("login").classList.add("hidden");

    document.getElementById("dashboard").classList.remove("hidden");

  } catch (e) {

    error.textContent = e.message;

  } finally {

    button.disabled = false;
    button.textContent = "ВОЙТИ";

  }
}

async function logout() {

  await fetch("/api/logout", {
    method: "POST"
  });

  document.getElementById("dashboard").classList.add("hidden");
  document.getElementById("login").classList.remove("hidden");

}

async function checkStatus() {

  try {

    const response = await fetch("/api/status");
    const data = await response.json();

    if (data.connected) {
      document.getElementById("login").classList.add("hidden");
      document.getElementById("dashboard").classList.remove("hidden");
    }

  } catch (e) {
    console.error("Status check failed");
  }

}

checkStatus();

</script>

</body>
</html>
`;

// Запуск сервера
app.listen(PORT, "0.0.0.0", () => {
  console.log("Liquidity website started on port " + PORT);
});
