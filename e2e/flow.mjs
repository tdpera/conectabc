// Fluxo ponta a ponta no modo demonstração: node e2e/flow.mjs [baseURL]
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.argv[2] || "http://localhost:3000";
const results = [];
const check = (name, ok) => { results.push([name, ok]); console.log(ok ? "✓" : "✗", name); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route(/tiles\.openfreemap/, (r) => r.abort());

// Visitante: payload público sem contatos
await page.goto(base + "/negocio/b-03");
await page.waitForSelector("text=Cantina Nonna Beatrice");
const html = await page.content();
check("visitante não vê telefone/WhatsApp", !html.includes("(47) 0000") && !html.includes("90000-"));

// Login demo pela tela de entrar
await page.goto(base + "/entrar");
await page.getByRole("button", { name: "Membro" }).click();
await page.waitForURL("**/painel");
await page.waitForSelector("text=Café Maré Alta");
check("login demo leva ao painel", true);

// Conversa com resposta automática
await page.goto(base + "/painel/conversas/b-16");
await page.getByLabel("Mensagem").fill("Olá! Teste automático de conversa.");
await page.keyboard.press("Enter");
await page.waitForSelector("text=Teste automático de conversa", { timeout: 8000 });
check("mensagem enviada aparece no chat", true);
const reply = await page.waitForSelector("text=/Que bom receber|Adorei a ideia|Combinado|Perfeito\\. Pode|Show!/", { timeout: 12000 }).then(() => true).catch(() => false);
check("resposta do outro negócio chega", reply);

// Proposta de parceria
await page.goto(base + "/negocio/b-16");
await page.getByRole("button", { name: "Propor parceria" }).click();
await page.getByRole("radio", { name: /Promoção conjunta/ }).click();
await page.getByLabel("Apresentação").fill("Que tal uma promoção conjunta no verão para nossos clientes?");
await page.getByRole("button", { name: "Enviar proposta" }).click();
await page.waitForSelector("text=/Parceria em andamento/", { timeout: 8000 });
check("proposta enviada bloqueia nova proposta (em andamento)", true);

// Aceitar proposta recebida
await page.goto(base + "/painel/parcerias");
await page.getByRole("button", { name: "Aceitar" }).first().waitFor();
const before = await page.getByRole("button", { name: "Aceitar" }).count();
await page.getByRole("button", { name: "Aceitar" }).first().click();
await page.waitForFunction((n) => [...document.querySelectorAll("button")].filter((b) => b.textContent.trim() === "Aceitar").length === n - 1, before, { timeout: 8000 }).catch(() => {});
const after = await page.getByRole("button", { name: "Aceitar" }).count();
check(`aceitar proposta muda o status (${before}→${after})`, after === before - 1);

// Pós-lançamento: membro sem assinatura vê paywall
await page.goto(base + "/explorar?agora=2027-01-16T12:00:00Z");
await page.waitForSelector("text=Falta só ativar sua assinatura", { timeout: 8000 });
check("paywall pós-lançamento para quem não paga", true);
// Assina pela demo
await page.goto(base + "/painel/assinatura/checkout-demo");
await page.getByRole("button", { name: /Assinar \(simulação\)/ }).click();
await page.waitForURL(/\/painel\/assinatura(\?status=sucesso)?$/, { timeout: 10000 });
await page.waitForSelector("text=Ativa", { timeout: 8000 });
await page.goto(base + "/explorar");
await page.waitForSelector("main a[href^='/negocio/']", { timeout: 10000 });
await page.waitForTimeout(800);
const n = await page.locator("main a[href^='/negocio/']").count();
check(`assinante vê só negócios pagantes (${n} de 40)`, n > 0 && n < 40);
// Visitante pós-lançamento vê bloqueio
await page.evaluate(() => localStorage.removeItem("conectabc:demo-session"));
await page.goto(base + "/explorar");
await page.waitForSelector("text=exclusiva para assinantes", { timeout: 8000 });
check("visitante pós-lançamento vê tela de bloqueio", true);

check("sem erros de página", errors.length === 0);
if (errors.length) console.log(errors);
await browser.close();
process.exit(results.every(([, ok]) => ok) ? 0 : 1);
