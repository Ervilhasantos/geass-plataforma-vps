from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import os
import time
import shutil

CAMINHO_PERFIL_CHROME = r"C:\Users\Zoom Personalizados\AppData\Local\Google\Chrome\User Data"
NOME_PERFIL = "Profile 15"

os.system("taskkill /F /IM chrome.exe /T >nul 2>&1")
time.sleep(2)

# Remove SingletonLock se existir
lock_path = os.path.join(CAMINHO_PERFIL_CHROME, "SingletonLock")
if os.path.exists(lock_path):
    try:
        os.remove(lock_path)
    except:
        pass

options = Options()
options.add_argument(f"--user-data-dir={CAMINHO_PERFIL_CHROME}")
options.add_argument(f"--profile-directory={NOME_PERFIL}")

options.add_argument("--disable-blink-features=AutomationControlled")
options.add_experimental_option("useAutomationExtension", False)
options.add_experimental_option("excludeSwitches", ["enable-automation"])

# Flags that might cause or fix DevToolsActivePort error
# options.add_argument("--remote-debugging-port=9222")
options.add_argument("--remote-allow-origins=*")
# options.add_argument("--no-sandbox")
# options.add_argument("--disable-dev-shm-usage")
# options.add_argument("--disable-gpu")
options.add_argument("--disable-crash-reporter")

service = Service(ChromeDriverManager().install())
try:
    print("Iniciando...")
    navegador = webdriver.Chrome(service=service, options=options)
    print("Sucesso!")
    time.sleep(2)
    navegador.quit()
except Exception as e:
    import traceback
    traceback.print_exc()
    print("Erro:", e)
