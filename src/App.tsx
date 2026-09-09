/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { 
  Copy, 
  Check, 
  Layers,
  FileCode,
  Cpu,
  Terminal,
  ExternalLink,
  ShieldAlert,
  Server
} from 'lucide-react';

export default function App() {
  const [copiedApp, setCopiedApp] = useState(false);
  const [copiedReq, setCopiedReq] = useState(false);
  const [copiedDocker, setCopiedDocker] = useState(false);
  const [activeTab, setActiveTab] = useState<'app' | 'requirements' | 'guide'>('app');

  // Streamlit app.py code
  const streamlitCode = `import streamlit as st
import imaplib
import email
import re
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# ==============================================================================
# إعدادات صفحة Streamlit
# ==============================================================================
st.set_page_config(
    page_title="أداة الأتمتة السحابية (IMAP + Headless Selenium)",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded"
)

# تخصيص المظهر وواجهة المستخدم
st.markdown("""
    <style>
    .main-title {
        font-size: 26px;
        font-weight: bold;
        color: #0284c7;
        margin-bottom: 4px;
    }
    .sub-title {
        font-size: 14px;
        color: #64748b;
        margin-bottom: 20px;
    }
    .stButton>button {
        width: 100%;
        background: linear-gradient(90deg, #0284c7, #0369a1);
        color: white;
        font-weight: bold;
        border-radius: 8px;
        height: 50px;
        font-size: 16px;
    }
    </style>
""", unsafe_allow_html=True)

# ==============================================================================
# 1. إعداد متصفح Chrome بوضع الـ Headless (المناسب للتشغيل السحابي)
# ==============================================================================
def get_headless_driver():
    options = Options()
    # تشغيل المتصفح بدون واجهة رسومية إطلاقاً
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-blink-features=AutomationControlled")
    # محاكاة مستخدم حقيقي لتجنب الحظر
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
    
    driver = webdriver.Chrome(options=options)
    return driver

# ==============================================================================
# 2. دالة سحب رمز التحقق (IMAP) مع إعادة المحاولة التلقائية
# ==============================================================================
def get_otp_from_imap(imap_server, imap_port, email_address, password, sender_email, otp_length=5, max_retries=15, delay_seconds=3, log_box=None):
    if log_box:
        log_box.write(f"📡 [IMAP] جاري الاتصال بالخادم \`{imap_server}:{imap_port}\` للحساب (\`{email_address}\`)...")

    for attempt in range(1, max_retries + 1):
        try:
            mail = imaplib.IMAP4_SSL(imap_server, int(imap_port))
            mail.login(email_address, password)
            mail.select('inbox')

            # البحث عن الإيميلات الواردة من هذا المرسل
            status, messages = mail.search(None, f'(FROM "{sender_email}")')
            
            if status == "OK" and messages[0]:
                mail_ids = messages[0].split()
                latest_email_id = mail_ids[-1]
                
                status, data = mail.fetch(latest_email_id, '(RFC822)')
                for response_part in data:
                    if isinstance(response_part, tuple):
                        msg = email.message_from_bytes(response_part[1])
                        body = ""
                        if msg.is_multipart():
                            for part in msg.walk():
                                if part.get_content_type() == "text/plain":
                                    body = part.get_payload(decode=True).decode(errors='ignore')
                                    break
                        else:
                            body = msg.get_payload(decode=True).decode(errors='ignore')

                        # البحث عن الكود بنمط ديناميكي
                        pattern = rf'\\b[A-Za-z0-9]{{{otp_length}}}\\b'
                        match = re.search(pattern, body)
                        if match:
                            otp_code = match.group(0)
                            if log_box:
                                log_box.write(f"✔ **تم استخراج الرمز بنجاح:** \`{otp_code}\` (في المحاولة {attempt})")
                            mail.logout()
                            return otp_code

            mail.logout()
            if log_box:
                log_box.write(f"⏳ محاولة ({attempt}/{max_retries}): الإيميل لم يصل بعد، جاري الانتظار {delay_seconds} ثوانٍ...")
            time.sleep(delay_seconds)

        except Exception as e:
            if log_box:
                log_box.write(f"⚠️ تنبيه IMAP في المحاولة {attempt}: {str(e)}")
            time.sleep(delay_seconds)

    return None

# ==============================================================================
# 3. دالة الأتمتة الرئيسية (Selenium Multi-Site Headless Automation)
# ==============================================================================
def run_automation(params, log_box, progress_bar):
    progress_bar.progress(10, text="جاري إطلاق متصفح Headless Chrome...")
    driver = None
    
    try:
        driver = get_headless_driver()
        wait = WebDriverWait(driver, 15)

        # ---------------- المرحلة الأولى: الموقع الأول (الأمان / المصدر) ----------------
        if params["site1_url"].strip():
            progress_bar.progress(25, text=f"فتح الموقع الأول: {params['site1_url']}...")
            log_box.write(f"🌐 [المرحلة 1] جاري فتح الموقع الأول: \`{params['site1_url']}\`")
            driver.get(params["site1_url"])
            time.sleep(2)
            log_box.write("✔ [المرحلة 1] اكتملت خطوات الموقع الأول بنجاح.")

        # ---------------- المرحلة الثانية: الموقع الثاني (الأساسي) ----------------
        progress_bar.progress(45, text=f"الانتقال للموقع الأساسي: {params['site2_url']}...")
        log_box.write(f"🌐 [المرحلة 2] الانتقال للموقع الأساسي: \`{params['site2_url']}\`")
        driver.get(params["site2_url"])

        # 1. فتح النافذة المنبثقة (Modal)
        log_box.write("🖱️ [الموقع 2] الضغط على زر القائمة...")
        element_1 = wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="ModalContentContainer"]/div[1]/div[1]/div[4]/div/div[1]/div/div[1]/a[1]/span')))
        element_1.click()
        time.sleep(1)

        # 2. إدخال بيانات الدخول (الحقول «r3» و «r4»)
        log_box.write("✍️ [الموقع 2] تعبئة حقول الدخول (Username / Password)...")
        field_r3 = wait.until(EC.presence_of_element_located((By.XPATH, '//*[@id="«r3»"]')))
        field_r3.clear()
        field_r3.send_keys(params["site2_user"])

        field_r4 = wait.until(EC.presence_of_element_located((By.XPATH, '//*[@id="«r4»"]')))
        field_r4.clear()
        field_r4.send_keys(params["site2_pass"])

        # 3. زر تسجيل الدخول
        log_box.write("🚀 [الموقع 2] الضغط على زر تسجيل الدخول...")
        submit_btn = wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="responsive_page_template_content"]/div[1]/div[1]/div/div/div/section/div[2]/div/form/div[4]/button')))
        submit_btn.click()
        time.sleep(3)

        # 4. الانتقال للإعدادات
        progress_bar.progress(65, text="الانتقال لصفحة الإعدادات وطلب رمز التحقق...")
        log_box.write("⚙️ [الموقع 2] الانتقال لصفحة الإعدادات...")
        wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="account_pulldown"]'))).click()
        wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="account_dropdown"]/div/a[2]/span'))).click()
        wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="main_content"]/div[2]/div[4]/div[1]/div[3]/a'))).click()
        wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="wizard_contents"]/div/a[2]/span'))).click()

        # 5. طلب رمز التحقق
        log_box.write("📩 [الموقع 2] الضغط على طلب رمز التحقق...")
        wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="forgot_login_code"]'))).click()

        # ---------------- المرحلة الثالثة: سحب الكود وحقنه ----------------
        progress_bar.progress(80, text="جاري سحب رمز التحقق من البريد عبر IMAP...")
        log_box.write("🔍 [المرحلة 3] جاري الاتصال بخادم البريد وسحب الـ OTP...")
        
        extracted_otp = get_otp_from_imap(
            imap_server=params["imap_server"],
            imap_port=params["imap_port"],
            email_address=params["imap_user"],
            password=params["imap_pass"],
            sender_email=params["sender_filter"],
            otp_length=params["otp_len"],
            log_box=log_box
        )

        if not extracted_otp:
            raise Exception("فشل سحب رمز التحقق من البريد، تم إيقاف العملية.")

        # حقن الكود داخل الحقل المخصص
        log_box.write(f"📥 [الموقع 2] حقن الرمز المستخرج [\`{extracted_otp}\`] في حقل التحقق...")
        code_input = wait.until(EC.presence_of_element_located((By.XPATH, '//*[@id="forgot_login_code_form"]/div[3]/input')))
        code_input.clear()
        code_input.send_keys(extracted_otp)
        time.sleep(1)

        # 6. الانتقال لصفحة تغيير الإيميل وكتابة الإيميل الجديد
        log_box.write("📧 [الموقع 2] الانتقال لصفحة تغيير الإيميل...")
        email_reset_btn = wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="email_reset"]')))
        email_reset_btn.click()

        log_box.write(f"✍️ [الموقع 2] كتابة الإيميل الجديد: \`{params['new_email']}\`")
        new_email_input = wait.until(EC.presence_of_element_located((By.XPATH, '//*[@id="change_email_area"]/input')))
        new_email_input.clear()
        new_email_input.send_keys(params['new_email'])

        progress_bar.progress(100, text="اكتملت جميع العمليات بنجاح!")
        st.balloons()
        st.success(f"🎉 **تمت العملية بنجاح!** الكود المسحوب: \`{extracted_otp}\` - تم تعيين الإيميل الجديد: \`{params['new_email']}\`")

    except Exception as e:
        progress_bar.progress(100, text="حدث خطأ أثناء التنفيذ")
        st.error(f"❌ خطأ أثناء التشغيل: {str(e)}")
        log_box.write(f"❌ **الخطأ:** {str(e)}")
    finally:
        if driver:
            driver.quit()
            log_box.write("🔒 تم إغلاق متصفح Selenium بأمان.")

# ==============================================================================
# واجهة المستخدم (UI Layout)
# ==============================================================================
st.markdown('<div class="main-title">⚡ لوحة الأتمتة السحابية (IMAP + Headless Selenium)</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-title">تطبيق ويب متكامل للتحكم بأتمتة المتصفح وسحب الـ OTP سحابياً بدون واجهة رسومية.</div>', unsafe_allow_html=True)

# الشريط الجانبي (Sidebar) لإعدادات البريد
with st.sidebar:
    st.header("⚙️ إعدادات مزود البريد (IMAP)")
    provider = st.selectbox(
        "اختر المزود:",
        ["Outlook / Hotmail", "Gmail", "Yahoo", "سيرفر خاص (Custom)"]
    )

    if provider == "Outlook / Hotmail":
        def_server, def_port = "imap-mail.outlook.com", 993
    elif provider == "Gmail":
        def_server, def_port = "imap.gmail.com", 993
    elif provider == "Yahoo":
        def_server, def_port = "imap.mail.yahoo.com", 993
    else:
        def_server, def_port = "mail.yourdomain.com", 993

    imap_server = st.text_input("IMAP Server Host", value=def_server)
    imap_port = st.number_input("IMAP Port", value=def_port, step=1)
    imap_user = st.text_input("Email Address", value="your_email@outlook.com")
    imap_pass = st.text_input("App Password", type="password", help="استخدم App Password لضمان تسجيل الدخول السحابي")
    sender_filter = st.text_input("تصفية مرسل الكود (From)", value="noreply@steampowered.com")
    otp_len = st.number_input("عدد خانات الـ OTP", value=5, min_value=3, max_value=12)

# التقسيم الرئيسي لبيانات الموقعين
col1, col2 = st.columns(2)

with col1:
    st.subheader("🌐 بيانات الموقع الأول (الأمان / المصدر)")
    site1_url = st.text_input("رابط الموقع الأول (اختياري)", value="https://login.live.com")
    site1_user = st.text_input("يوزر / إيميل الموقع الأول", value="security_account@outlook.com")
    site1_pass = st.text_input("باسورد الموقع الأول", type="password", value="password123")

with col2:
    st.subheader("🌐 بيانات الموقع الثاني (الأساسي للحسابات)")
    site2_url = st.text_input("رابط الموقع الأساسي", value="https://store.steampowered.com/login")
    site2_user = st.text_input("اسم المستخدم (حقل r3)", value="main_username")
    site2_pass = st.text_input("كلمة المرور (حقل r4)", type="password", value="main_password")
    new_email = st.text_input("الإيميل الجديد للتغيير إليه", value="new_target_email@outlook.com")

st.divider()

# زر التشغيل وسجل الأحداث الحي
start_btn = st.button("🚀 بدء تشغيل الأتمتة السحابية الآن")

progress_bar = st.empty()
log_box = st.container(border=True)

if start_btn:
    if not imap_user or not imap_pass:
        st.warning("⚠️ يرجى تعبئة إيميل وباسورد الـ IMAP في الشريط الجانبي أولاً.")
    else:
        params = {
            "imap_server": imap_server,
            "imap_port": imap_port,
            "imap_user": imap_user,
            "imap_pass": imap_pass,
            "sender_filter": sender_filter,
            "otp_len": int(otp_len),
            "site1_url": site1_url,
            "site1_user": site1_user,
            "site1_pass": site1_pass,
            "site2_url": site2_url,
            "site2_user": site2_user,
            "site2_pass": site2_pass,
            "new_email": new_email
        }
        with log_box:
            st.write("📋 **سجل العمليات المباشر (Live Output):**")
            run_automation(params, log_box, progress_bar)
`;

  // requirements.txt
  const requirementsTxt = `streamlit>=1.32.0
selenium>=4.18.0
webdriver-manager>=4.0.1
`;

  // Dockerfile
  const dockerfileTxt = `FROM python:3.11-slim

# تثبيت متصفح Google Chrome ومشغلات السيرفر
RUN apt-get update && apt-get install -y \\
    wget \\
    gnupg \\
    unzip \\
    curl \\
    chromium \\
    chromium-driver \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

EXPOSE 8501

CMD ["streamlit", "run", "app.py", "--server.port=8501", "--server.address=0.0.0.0"]
`;

  const copyApp = () => {
    navigator.clipboard.writeText(streamlitCode);
    setCopiedApp(true);
    setTimeout(() => setCopiedApp(false), 2000);
  };

  const copyReq = () => {
    navigator.clipboard.writeText(requirementsTxt);
    setCopiedReq(true);
    setTimeout(() => setCopiedReq(false), 2000);
  };

  const copyDocker = () => {
    navigator.clipboard.writeText(dockerfileTxt);
    setCopiedDocker(true);
    setTimeout(() => setCopiedDocker(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Cpu size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg text-white">Streamlit Cloud App (Headless Selenium)</h1>
                <span className="bg-sky-500/20 text-sky-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-sky-500/30">
                  Headless Mode
                </span>
              </div>
              <p className="text-xs text-slate-400">تحويل كود البايثون إلى تطبيق Streamlit جاهز للرفع والتشغيل السحابي</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyApp}
              className="flex items-center gap-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-xs sm:text-sm font-medium px-4 py-2 rounded-xl transition-all shadow-md shadow-sky-950/40 cursor-pointer"
            >
              {copiedApp ? <Check size={16} /> : <Copy size={16} />}
              <span>{copiedApp ? 'تم نسخ app.py!' : 'نسخ ملف app.py'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-slate-800 pb-3 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('app')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'app'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <FileCode size={16} />
            <span>ملف التطبيق الرئيسي (app.py)</span>
          </button>

          <button
            onClick={() => setActiveTab('requirements')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'requirements'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Layers size={16} />
            <span>متطلبات النشر (requirements.txt & Dockerfile)</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'guide'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Server size={16} />
            <span>دليل النشر والتشغيل السحابي</span>
          </button>
        </div>

        {/* TAB 1: STREAMLIT APP.PY CODE */}
        {activeTab === 'app' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="bg-sky-500/10 border border-sky-500/30 text-sky-400 px-2.5 py-1 rounded-lg font-mono font-bold">
                  app.py
                </span>
                <span className="text-slate-400">
                  تم تضمين إعدادات <code className="text-sky-400">--headless=new</code> لتعمل على السيرفرات السحابية (Linux / Docker / Streamlit Cloud) بسلاسة.
                </span>
              </div>
              <button
                onClick={copyApp}
                className="text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700"
              >
                {copiedApp ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copiedApp ? 'تم النسخ' : 'نسخ الكود'}</span>
              </button>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
              <pre className="p-5 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-[640px] select-all">
                <code>{streamlitCode}</code>
              </pre>
            </div>
          </div>
        )}

        {/* TAB 2: REQUIREMENTS & DEPLOYMENT */}
        {activeTab === 'requirements' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded-lg font-mono font-bold">
                    requirements.txt
                  </span>
                </div>
                <button
                  onClick={copyReq}
                  className="text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700"
                >
                  {copiedReq ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copiedReq ? 'تم النسخ' : 'نسخ'}</span>
                </button>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 font-mono text-xs text-emerald-400">
                <pre>{requirementsTxt}</pre>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-xs space-y-3">
                <h4 className="font-bold text-white text-sm">💡 خطوات التشغيل محلياً:</h4>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300 leading-relaxed">
                  <li>تثبيت المكاتب: <code className="text-sky-400">pip install -r requirements.txt</code></li>
                  <li>تشغيل التطبيق: <code className="text-sky-400">streamlit run app.py</code></li>
                  <li>سيفتح المتصفح مباشرة على: <code className="text-emerald-400">http://localhost:8501</code></li>
                </ol>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between text-xs">
                <span className="bg-purple-500/10 border border-purple-500/30 text-purple-400 px-2.5 py-1 rounded-lg font-mono font-bold">
                  Dockerfile (للنشر السحابي / VPS)
                </span>
                <button
                  onClick={copyDocker}
                  className="text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700"
                >
                  {copiedDocker ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copiedDocker ? 'تم النسخ' : 'نسخ'}</span>
                </button>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 font-mono text-xs text-purple-300">
                <pre>{dockerfileTxt}</pre>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-xs space-y-2 text-slate-300">
                <h4 className="font-bold text-white text-sm">☁️ خيارات النشر المدعومة:</h4>
                <p>1. <strong>Streamlit Community Cloud:</strong> مجاني بالكامل عن طريق ربط مستودع GitHub.</p>
                <p>2. <strong>VPS / Docker / Railway:</strong> استخدام الـ Dockerfile لتثبيت حزم Chromium بدون أخطاء GUI.</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: GUIDE */}
        {activeTab === 'guide' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Server className="text-sky-400" size={20} />
                <span>كيف يعمل السكربت بوضع Headless على السيرفرات؟</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="text-sky-400 font-bold text-sm mb-1">1. خالي من الواجهات (No GUI)</div>
                  <p className="text-xs text-slate-400">
                    يعمل بأمر <code className="text-slate-300">--headless=new</code> فلا يحتاج لشاشة عرض أو X11 server.
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="text-emerald-400 font-bold text-sm mb-1">2. توفير الذاكرة (Dev-shm)</div>
                  <p className="text-xs text-slate-400">
                    أمر <code className="text-slate-300">--disable-dev-shm-usage</code> يمنع كراش المتصفح عند قلة الرام بالسيرفر.
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="text-purple-400 font-bold text-sm mb-1">3. سحب OTP مباشر</div>
                  <p className="text-xs text-slate-400">
                    اتصال SSL مباشر بخادم IMAP وقراءة الرسائل وحقن الرمز وإظهار السجلات فورياً في الواجهة.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
