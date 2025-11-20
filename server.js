// ==========================================================
// 🌍 خبير الهجرة - Gemini + Supabase (بدون اشتراكات وبدون user_memory)
// ==========================================================

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ===============================================
// 🧠 مفاتيح البيئة
// ===============================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;


if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {

  console.error("❌ ملف .env ناقص");
  process.exit(1);
}

// ===============================================
// 🔗 Supabase
// ===============================================
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ===============================================
// 🧩 شخصية خبير الهجرة
// ===============================================
const systemPrompt = `




أنت مساعد هجرة عالمي ذكي محترف، وظيفتك هي مساعدة أي شخص في الهجرة أو السفر إلى أي دولة في العالم بطريقة واقعية وعملية وسهلة ومطمئنة.

🧠 أسلوبك:
- لطيف، إنساني، مطمئن، يجلب الثقة والارتياح.
- تتحدث بثقة عالية وتفصيل دقيق، وكأن لديك خبرة 20 سنة.
- تقدم حلول حقيقية حتى لو لم تُذكر على الإنترنت، لكن تكون منطقية وقابلة للتطبيق.
- لا تعطي إجابات عامة أبدًا.
- تقدم خطوات واضحة وجاهزة يمكن اتباعها فورًا.

🎯 عند ذكر المستخدم أي دولة (مثل ألمانيا، كندا، السويد…):
1. افترض أنه يريد الهجرة إليها.
2. اعطه خطة هجرة احترافية وجاهزة خطوة بخطوة.
3. قبل الخطة، اسأله أسئلة  لجمع المعلومات الضرورية:
   - العمر
   - الجنسية
   - الخبرة المهنية
   - مستوى اللغة
   - الميزانية
   - الهدف (عمل، استقرار، مستقبل أفضل…)
   الى اخرة اي  سؤال تحتاج معرفتة عن المستخدم اسئلة ولا تترد ابدا
   5. بعد جمع المعلومات، قدم أفضل مسار للهجرة بناءً على وضعه.

📌 قواعد مهمة:
- لا تسأل عن “نوع الهجرة” (دراسة/سياحة/عمل/لجوء) إلا إذا المستخدم سأل عنها بنفسه.
- إذا كان المستخدم فقط يسأل سؤالًا عامًا عن الهجرة، أجب فورًا وباحتراف.
- دائمًا قدم خطة واضحة جاهزة يمكن تنفيذها مباشرة.
- قدم بدائل أخرى للدول المناسبة لوضعه.
- حتى لو كان ملف المستخدم ضعيفًا، ابحث له عن طريق يمكنه البدء به.

💬 الهدف:
أن يشعر المستخدم أنه يتحدث مع خبير هجرة حقيقي يفهمه، ويرشده، ويعطيه خطة ناجحة للهجرة بسهولة وذكاء وبدون أي تعقيد.


`;

// ===============================================
// 🔐 Signup — إنشاء حساب
// ===============================================
app.post("/api/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) throw error;

    // إنشاء بروفايل
    await supabase.from("profiles").insert([
      { user_id: data.user.id, display_name: email }
    ]);

    res.json({ success: true, userId: data.user.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===============================================
// 🔐 Login — تسجيل الدخول
// ===============================================
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    res.json({
      success: true,
      user: data.user,
      session: data.session
    });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});





// ===============================================
// 🔐 التحقق من اشتراك المستخدم
// ===============================================
async function userHasActiveSubscription(userId) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return false;
  return true;
}


// ===============================================
// 🔍 API — جلب حالة اشتراك المستخدم
// ===============================================
app.get("/api/subscription", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return res.status(401).json({ error: "Missing access token" });
    }

    // الحصول على جلسة المستخدم من Supabase
    const { data: { user }, error: userError } =
      await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // البحث عن اشتراك المستخدم في قاعدة البيانات
    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    return res.json({ subscription });
  } catch (err) {
    console.error("Subscription API Error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});




// ===============================================
// 💬 Chat API — محادثة Gemini
// ===============================================
app.post("/api/chat", async (req, res) => {
  try {
    const { message, userId, country, conversationId } = req.body;

// ⛔ منع غير المشترك من استخدام الدردشة
const subscribed = await userHasActiveSubscription(userId);
if (!subscribed) {
  return res.status(403).json({
    error: "يجب الاشتراك لاستخدام الدردشة",
    requiresSubscription: true
  });
}




    if (!message || !userId || !conversationId) {
      return res.status(400).json({ error: "القيم ناقصة" });
    }

    // جلب آخر 25 رسالة للمحادثة
    const { data: history } = await supabase
      .from("chat_history")
      .select("role, message")
      .eq("user_id", userId)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(25);

    const formattedHistory = history
      ?.map((m) => `${m.role}: ${m.message}`)
      .join("\n") || "";

    const fullPrompt = `
${systemPrompt}

الرسائل السابقة:
${formattedHistory}

رسالة المستخدم:
${message}
`;

    // إرسال الطلب إلى Gemini
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      { contents: [{ role: "user", parts: [{ text: fullPrompt }] }] },
      { headers: { "Content-Type": "application/json" } }
    );

    const reply =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "⚠️ حدث خطأ أثناء الاتصال بـ Gemini.";

    // حفظ الرسالة وردّ الذكاء
    await supabase.from("chat_history").insert([
      {
        user_id: userId,
        conversation_id: conversationId,
        role: "user",
        message,
        country
      },
      {
        user_id: userId,
        conversation_id: conversationId,
        role: "assistant",
        message: reply,
        country
      }
    ]);

    res.json({ response: reply });

  } catch (err) {
    console.error("Chat Error:", err.message);
    res.status(500).json({ error: "خطأ في الاتصال بـ Gemini" });
  }
});

// ===============================================
// 📜 جلب المحادثة القديمة
// ===============================================
app.post("/api/chat/history", async (req, res) => {
  try {
    const { userId, conversationId } = req.body;

    const { data, error } = await supabase
      .from("chat_history")
      .select("role, message, created_at")
      .eq("user_id", userId)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    res.json({ history: data });

  } catch (err) {
    res.status(500).json({ error: "فشل تحميل المحادثة" });
  }
});

// ===============================================
// 🏠 serve website (frontend files)
// ===============================================
app.use(express.static(path.join(__dirname)));





app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});





// ===============================================
// 🚀 تشغيل السيرفر
// ===============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ السيرفر يعمل: http://localhost:${PORT}`);
});

