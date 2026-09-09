import streamlit as st
import imaplib
import email
import re
import time
import os
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# ==============================================================================
# إعدادات صفحة Streamlit
# ==============================================================================
st.set_page_config(
    page_title="أداة الأتمتة السحابية (IMAP + Selenium Headless)",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded"
)

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
# 1. إعداد متصفح Chrome السحابي (Selenium Headless المتوافق مع Streamlit Cloud)
# ==============================================================================
def get_headless_driver(log_box=None):
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
    
    # فحص مسارات Chromium المثبتة على سيرفرات Linux السحابية
    candidate_paths = [
        ("/usr/bin/chromium", "/usr/bin/chromedriver"),
        ("/usr/bin/chromium-browser", "/usr/lib/chromium-browser/chromedriver"),
        ("/usr/bin/google-chrome", "/usr/bin/chromedriver")
    ]
    
    for chromepath, driverpath in candidate_paths:
        if os.path.exists(chromepath) and os.path.exists(driverpath):
            if log_box:
                log_box.write(f"🔧 تشغيل مشغل المتصفح من المسار: `{driverpath}`")
            options.binary_location = chromepath
            service = Service(executable_path=driverpath)
            return webdriver.Chrome(service=service, options=options)

    # في حال التشغيل المحلي أو مع مدير Selenium المدمج
    return webdriver.Chrome(options=options)

# ==============================================================================
# 2. دالة استخراج رمز التحقق عبر IMAP مع تنظيف اسم السيرفر
# ==============================================================================
def clean_host(host_str):
    h = re.sub(r'^https?://', '', host_str.strip())
    h = h.split('/')[0]
    return h

def get_otp_from_imap(imap_server, imap_port, email_address, password, sender_email, otp_length=5, max_retries=15, delay_seconds=3, log_box=None):
    clean_srv = clean_host(imap_server)
    if log_box:
        log_box.write(f"📡 [IMAP] الاتصال بالخادم `{clean_srv}:{imap_port}` للحساب (`{email_address}`)...")

    for attempt in range(1, max_retries + 1):
        try:
            mail = imaplib.IMAP4_SSL(clean_srv, int(imap_port))
            mail.login(email_address, password)
            mail.select('inbox')

            status, messages = mail.search(None, f'(FROM "{sender_email}")') if sender_email.strip() else mail.search(None, 'ALL')
            
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

                        pattern = rf'\b[A-Za-z0-9]{{{otp_length}}}\b'
                        match = re.search(pattern, body)
                        if match:
                            otp_code = match.group(0)
                            if log_box:
                                log_box.write(f"✔ **تم استخراج الرمز بنجاح:** `{otp_code}` (في المحاولة {attempt})")
                            mail.logout()
                            return otp_code

            mail.logout()
            if log_box:
                log_box.write(f"⏳ محاولة ({attempt}/{max_retries}): الإيميل لم يصل بعد، انتظار {delay_seconds} ثوانٍ...")
            time.sleep(delay_seconds)

        except Exception as e:
            if log_box:
                log_box.write(f"⚠️ تنبيه IMAP في المحاولة {attempt}: {str(e)}")
            time.sleep(delay_seconds)

    return None

# ==============================================================================
# 3. دالة الأتمتة الرئيسية عبر Selenium
# ==============================================================================
def run_automation(params, log_box, progress_bar):
    progress_bar.progress(10, text="جاري إطلاق متصفح Chrome Headless...")
    driver = None
    
    try:
        driver = get_headless_driver(log_box)
        wait = WebDriverWait(driver, 15)

        if params["site1_url"].strip():
            progress_bar.progress(25, text=f"فتح الموقع الأول: {params['site1_url']}...")
            log_box.write(f"🌐 [المرحلة 1] جاري فتح الموقع الأول: `{params['site1_url']}`")
            driver.get(params["site1_url"])
            time.sleep(2)
            log_box.write("✔ [المرحلة 1] اكتملت خطوات الموقع الأول بنجاح.")

        progress_bar.progress(45, text=f"الانتقال للموقع الأساسي: {params['site2_url']}...")
        log_box.write(f"🌐 [المرحلة 2] الانتقال للموقع الأساسي: `{params['site2_url']}`")
        driver.get(params["site2_url"])

        log_box.write("🖱️ [الموقع 2] الضغط على زر القائمة...")
        try:
            element_1 = wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="ModalContentContainer"]/div[1]/div[1]/div[4]/div/div[1]/div/div[1]/a[1]/span')))
            element_1.click()
        except Exception:
            pass
        time.sleep(1)

        log_box.write("✍️ [الموقع 2] تعبئة حقول الدخول (Username / Password)...")
        field_r3 = wait.until(EC.presence_of_element_located((By.XPATH, '//*[@id="«r3»"]')))
        field_r3.clear()
        field_r3.send_keys(params["site2_user"])

        field_r4 = wait.until(EC.presence_of_element_located((By.XPATH, '//*[@id="«r4»"]')))
        field_r4.clear()
        field_r4.send_keys(params["site2_pass"])

        log_box.write("🚀 [الموقع 2] الضغط على زر تسجيل الدخول...")
        submit_btn = wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="responsive_page_template_content"]/div[1]/div[1]/div/div/div/section/div[2]/div/form/div[4]/button')))
        submit_btn.click()
        time.sleep(3)

        progress_bar.progress(65, text="الانتقال لصفحة الإعدادات وطلب رمز التحقق...")
        log_box.write("⚙️ [الموقع 2] الانتقال لصفحة الإعدادات...")
        try:
            wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="account_pulldown"]'))).click()
            wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="account_dropdown"]/div/a[2]/span'))).click()
            wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="main_content"]/div[2]/div[4]/div[1]/div[3]/a'))).click()
            wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="wizard_contents"]/div/a[2]/span'))).click()
        except Exception:
            log_box.write("ℹ️ المتابعة للخطوة التالية في الإعدادات...")

        log_box.write("📩 [الموقع 2] الضغط على طلب رمز التحقق...")
        try:
            wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="forgot_login_code"]'))).click()
        except Exception:
            pass

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

        log_box.write(f"📥 [الموقع 2] حقن الرمز المستخرج [`{extracted_otp}`] في حقل التحقق...")
        code_input = wait.until(EC.presence_of_element_located((By.XPATH, '//*[@id="forgot_login_code_form"]/div[3]/input')))
        code_input.clear()
        code_input.send_keys(extracted_otp)
        time.sleep(1)

        log_box.write("📧 [الموقع 2] الانتقال لصفحة تغيير الإيميل...")
        try:
            email_reset_btn = wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="email_reset"]')))
            email_reset_btn.click()
        except Exception:
            pass

        log_box.write(f"✍️ [الموقع 2] كتابة الإيميل الجديد: `{params['new_email']}`")
        new_email_input = wait.until(EC.presence_of_element_located((By.XPATH, '//*[@id="change_email_area"]/input')))
        new_email_input.clear()
        new_email_input.send_keys(params['new_email'])

        progress_bar.progress(100, text="اكتملت جميع العمليات بنجاح!")
        st.balloons()
        st.success(f"🎉 **تمت العملية بنجاح!** الكود المسحوب: `{extracted_otp}` - تم تعيين الإيميل الجديد: `{params['new_email']}`")

    except Exception as e:
        progress_bar.progress(100, text="حدث خطأ أثناء التنفيذ")
        st.error(f"❌ خطأ أثناء التشغيل: {str(e)}")
        log_box.write(f"❌ **الخطأ:** {str(e)}")
    finally:
        if driver:
            try:
                driver.quit()
                log_box.write("🔒 تم إغلاق متصفح Selenium بأمان.")
            except Exception:
                pass

# ==============================================================================
# واجهة المستخدم (UI Layout)
# ==============================================================================
st.markdown('<div class="main-title">⚡ لوحة الأتمتة السحابية (IMAP + Headless Selenium)</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-title">تطبيق ويب متكامل للتحكم بأتمتة المتصفح وسحب الـ OTP سحابياً عبر Selenium Chrome Headless.</div>', unsafe_allow_html=True)

with st.sidebar:
    st.header("⚙️ إعدادات مزود البريد (IMAP)")
    provider = st.selectbox(
        "اختر المزود:",
        ["سيرفر خاص (Custom)", "Outlook / Hotmail", "Gmail", "Yahoo"]
    )

    if provider == "Outlook / Hotmail":
        def_server, def_port = "imap-mail.outlook.com", 993
    elif provider == "Gmail":
        def_server, def_port = "imap.gmail.com", 993
    elif provider == "Yahoo":
        def_server, def_port = "imap.mail.yahoo.com", 993
    else:
        def_server, def_port = "mail.xomail.club", 993

    imap_server = st.text_input("IMAP Server Host (بدون http://)", value=def_server)
    imap_port = st.number_input("IMAP Port", value=def_port, step=1)
    imap_user = st.text_input("Email Address", value="se889388@fknvzd81.icu")
    imap_pass = st.text_input("Password / App Password", type="password")
    sender_filter = st.text_input("تصفية مرسل الكود (From)", value="noreply@steampowered.com")
    otp_len = st.number_input("عدد خانات الـ OTP", value=5, min_value=3, max_value=12)

col1, col2 = st.columns(2)

with col1:
    st.subheader("🌐 بيانات الموقع الأول (الأمان / المصدر)")
    site1_url = st.text_input("رابط الموقع الأول (اختياري)", value="")
    site1_user = st.text_input("يوزر / إيميل الموقع الأول", value="")
    site1_pass = st.text_input("باسورد الموقع الأول", type="password", value="")

with col2:
    st.subheader("🌐 بيانات الموقع الثاني (الأساسي للحسابات)")
    site2_url = st.text_input("رابط الموقع الأساسي", value="https://store.steampowered.com/login")
    site2_user = st.text_input("اسم المستخدم (حقل r3)", value="")
    site2_pass = st.text_input("كلمة المرور (حقل r4)", type="password", value="")
    new_email = st.text_input("الإيميل الجديد للتغيير إليه", value="")

st.divider()

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
