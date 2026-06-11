import os
import sys
import time
import csv
import re
import subprocess
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
from webdriver_manager.chrome import ChromeDriverManager

# ==============================================================================
# CONFIGURAÇÕES DE CAMINHOS DO USUÁRIO
# ==============================================================================
PASTA_VIDEOS = r"C:\Users\Zoom Personalizados\Documents\CURSOS\FELIPE DECHAMPS"
CAMINHO_PERFIL_CHROME = r"C:\Users\Zoom Personalizados\AppData\Local\Google\Chrome\User Data"
NOME_PERFIL = "Profile 15"
ARQUIVO_RESULTADOS = "aulas_youtube.csv"
ARQUIVO_TXT = "links_ordenados.txt"

# Extensões de vídeo suportadas
EXTENSOES_VIDEOS = ('.mp4', '.mkv', '.avi', '.mov', '.webm')

def obter_videos_ordenados_por_data(pasta_raiz):
    """
    Busca todos os vídeos nas pastas, garantindo a ordem cronológica absoluta.
    """
    print("📋 Analisando pastas e organizando fila cronológica absoluta...")
    
    videos_com_data = []
    
    for raiz, dirs, arquivos in os.walk(pasta_raiz):
        for arq in arquivos:
            if arq.lower().endswith(EXTENSOES_VIDEOS):
                caminho_completo = os.path.join(raiz, arq)
                # Pega a data de modificação real do arquivo no disco
                data_arquivo = os.path.getmtime(caminho_completo)
                videos_com_data.append((caminho_completo, data_arquivo))
                
    # Ordena TODOS os vídeos do mais antigo para o mais novo
    videos_com_data.sort(key=lambda x: x[1])
    
    return [caminho for caminho, _ in videos_com_data]

import shutil

DESTINO_UD = r"C:\temp_chrome_profile_yt"

def clonar_perfil_chrome():
    print("🔄 Preparando ambiente isolado do Chrome (clonando perfil)...")
    try:
        if not os.path.exists(DESTINO_UD):
            os.makedirs(DESTINO_UD)
            
        local_state_src = os.path.join(CAMINHO_PERFIL_CHROME, 'Local State')
        local_state_dst = os.path.join(DESTINO_UD, 'Local State')
        if os.path.exists(local_state_src):
            shutil.copy2(local_state_src, local_state_dst)
            
        origem_perfil = os.path.join(CAMINHO_PERFIL_CHROME, NOME_PERFIL)
        destino_perfil = os.path.join(DESTINO_UD, NOME_PERFIL)
        
        # Se já existe um clone, remove para garantir dados frescos, ou apenas atualiza.
        # Para ser mais seguro e rápido, se não existir, a gente copia:
        if not os.path.exists(destino_perfil) and os.path.exists(origem_perfil):
            # Ignora pastas pesadas que não importam pro login do YouTube
            shutil.copytree(origem_perfil, destino_perfil, ignore=shutil.ignore_patterns('Cache', 'Code Cache', 'Service Worker', 'Media Cache'))
            
        print("✅ Ambiente isolado pronto!")
    except Exception as e:
        print(f"⚠️ Erro ao clonar perfil (pode seguir em frente): {e}")

def inicializar_navegador():
    print(f"🚀 Iniciando o Chrome de forma isolada com o perfil '{NOME_PERFIL}'...")
    
    clonar_perfil_chrome()
    
    options = Options()
    options.add_argument(f"--user-data-dir={DESTINO_UD}")
    options.add_argument(f"--profile-directory={NOME_PERFIL}")
    
    # Proteções Anti-Bot
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("useAutomationExtension", False)
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    
    # Manter o navegador aberto após o script (opcional, bom para debugar)
    options.add_experimental_option("detach", True)
    
    service = Service(ChromeDriverManager().install())
    
    print("🔌 Conectando o WebDriver...")
    navegador = webdriver.Chrome(service=service, options=options)
    
    # Mascara o WebDriver
    try:
        navegador.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
            "source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        })
    except:
        pass
    
    return navegador

def upload_video_youtube(navegador, caminho_video, index):
    nome_arquivo = os.path.basename(caminho_video)
    # Limpa o nome do arquivo e limita a 95 caracteres (o YouTube aceita max 100)
    nome_aula_limpo = os.path.splitext(nome_arquivo)[0].replace("_", " ").replace("-", " ")[:95]
    
    print(f"\n📤 [{index}] Enviando: {nome_arquivo}")
    print(f"📍 Caminho: {caminho_video}")
    
    # Acessa a página de upload
    navegador.get("https://youtube.com/upload")
    wait = WebDriverWait(navegador, 60)
    
    # 1. Envia o arquivo
    input_file = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='file']")))
    input_file.send_keys(caminho_video)
    print("⏳ Arquivo enviado! Aguardando carregamento dos campos...")
    
    # 2. Aguarda um tempo para o YouTube puxar o nome do arquivo automaticamente
    time.sleep(3)
    print(f"📝 O YouTube usará o nome original do arquivo como título.")
    
    # 3. Não para crianças
    radio_kids = wait.until(EC.presence_of_element_located((By.XPATH, "//*[@name='VIDEO_MADE_FOR_KIDS_NOT_MFK']")))
    navegador.execute_script("arguments[0].click();", radio_kids)
    
    # 4. Avança pelas telas (3 vezes para chegar em Visibilidade)
    for i in range(3):
        time.sleep(1)
        botao_proximo = wait.until(EC.presence_of_element_located((By.XPATH, "//ytcp-button[@id='next-button']")))
        navegador.execute_script("arguments[0].click();", botao_proximo)
        print(f"➡️ Avançando etapa {i+1}...")
        
    # 5. Define como Não Listado
    print("🔒 Configurando visibilidade como 'Não listado'...")
    time.sleep(1)
    radio_nao_listado = wait.until(EC.presence_of_element_located((By.XPATH, "//*[@name='UNLISTED']")))
    navegador.execute_script("arguments[0].click();", radio_nao_listado)
    time.sleep(1)
    
    # 6. Captura o link
    print("🔗 Extraindo link do vídeo...")
    elemento_link = wait.until(EC.presence_of_element_located((By.XPATH, "//a[contains(@href, 'youtu.be')]")))
    link_completo = elemento_link.get_attribute("href")
    
    youtube_id = ""
    match = re.search(r"youtu\.be/([a-zA-Z0-9_-]{11})", link_completo)
    if match:
        youtube_id = match.group(1)
    else:
        match_alt = re.search(r"v=([a-zA-Z0-9_-]{11})", link_completo)
        if match_alt:
            youtube_id = match_alt.group(1)
            
    print(f"✅ ID extraído: {youtube_id}")
    
    # 7. Salva
    botao_salvar = wait.until(EC.presence_of_element_located((By.XPATH, "//ytcp-button[@id='done-button']")))
    navegador.execute_script("arguments[0].click();", botao_salvar)
    print("💾 Concluindo envio e fechando modal...")
    
    time.sleep(7) # Aguarda fechar o popup
    
    return nome_aula_limpo, youtube_id

def main():
    fila_videos = obter_videos_ordenados_por_data(PASTA_VIDEOS)
    total_videos = len(fila_videos)
    
    if total_videos == 0:
        print("❌ Nenhum vídeo encontrado. Verifique a pasta.")
        return
        
    print(f"✨ Encontrados {total_videos} vídeos organizados cronologicamente.")
    
    # 1. Carrega os vídeos já enviados para saber onde parou
    videos_ja_enviados = set()
    if os.path.exists(ARQUIVO_RESULTADOS):
        try:
            with open(ARQUIVO_RESULTADOS, 'r', encoding='utf-8') as f:
                leitor = csv.reader(f)
                next(leitor, None)  # Pula o cabeçalho se houver
                for linha in leitor:
                    if linha and len(linha) > 0:
                        # Guarda em minúsculas e sem espaços extras para comparação segura
                        videos_ja_enviados.add(linha[0].strip().lower())
            print(f"📦 Carregados {len(videos_ja_enviados)} vídeos já enviados anteriormente.")
        except Exception as e:
            print(f"⚠️ Erro ao ler arquivo de histórico: {e}")
            
    # 2. Filtra a fila para manter apenas o que está pendente
    fila_pendente = []
    for index, caminho_video in enumerate(fila_videos, start=1):
        nome_arquivo = os.path.basename(caminho_video)
        nome_aula_limpo = os.path.splitext(nome_arquivo)[0].replace("_", " ").replace("-", " ")[:95].strip().lower()
        
        if nome_aula_limpo in videos_ja_enviados:
            continue
        fila_pendente.append((index, caminho_video))
        
    total_pendentes = len(fila_pendente)
    if total_pendentes == 0:
        print("🎉 Todos os vídeos da pasta já foram enviados com sucesso!")
        return
        
    print(f"🚀 Iniciando envio de {total_pendentes} vídeos pendentes (de um total de {total_videos})...")
    
    # 3. Inicializa o Chrome somente se houver trabalho a fazer
    navegador = inicializar_navegador()
    
    modo_abertura = 'a' if os.path.exists(ARQUIVO_RESULTADOS) else 'w'
    
    try:
        with open(ARQUIVO_RESULTADOS, modo_abertura, newline='', encoding='utf-8') as f, \
             open(ARQUIVO_TXT, modo_abertura, encoding='utf-8') as f_txt:
            
            escritor = csv.writer(f)
            if modo_abertura == 'w':
                escritor.writerow(["nome_aula", "youtube_id", "ordem"])
                
            for index_original, caminho_video in fila_pendente:
                try:
                    # Trava de Segurança: Fecha abas extras (anúncios, popups)
                    while len(navegador.window_handles) > 1:
                        navegador.switch_to.window(navegador.window_handles[-1])
                        navegador.close()
                    navegador.switch_to.window(navegador.window_handles[0])

                    nome, yt_id = upload_video_youtube(navegador, caminho_video, index_original)
                    
                    if yt_id:
                        # Grava CSV
                        escritor.writerow([nome, yt_id, index_original])
                        f.flush()
                        
                        # Grava TXT
                        f_txt.write(f"https://youtu.be/{yt_id}\n")
                        f_txt.flush()
                        
                        print(f"📊 Registrado! Ordem: {index_original} | Link: https://youtu.be/{yt_id}")
                    else:
                        print("⚠️ Erro: Link não capturado.")
                    
                except Exception as e:
                    erro_msg = str(e)
                    print(f"⚠️ Erro no vídeo {os.path.basename(caminho_video)}: {erro_msg}")
                    
                    # Se a sessão foi invalidada/fechada, aborta o script para não rodar em loop de erro
                    if "invalid session id" in erro_msg.lower() or "chrome not reachable" in erro_msg.lower():
                        print("❌ Sessão do Chrome perdida. Abortando execução...")
                        raise KeyboardInterrupt
                        
                    print("Pulando para o próximo...")
                    continue
                    
    except KeyboardInterrupt:
        print("\n🛑 Processo interrompido pelo usuário.")
    finally:
        try:
            navegador.quit()
        except:
            pass
        print("\n🏁 Processo de upload finalizado.")

if __name__ == "__main__":
    main()