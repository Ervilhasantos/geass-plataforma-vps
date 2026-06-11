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
NOME_PERFIL = "Profile 4"
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

def obter_duracao_mp4(caminho_arquivo):
    """
    Lê a box 'mvhd' do arquivo MP4 para obter a duração do vídeo sem dependências externas.
    """
    try:
        with open(caminho_arquivo, 'rb') as f:
            chunk_size = 64 * 1024
            while True:
                pos = f.tell()
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                idx = chunk.find(b'mvhd')
                if idx != -1:
                    f.seek(pos + idx - 4)
                    box_header = f.read(8)
                    box_size = int.from_bytes(box_header[0:4], 'big')
                    box_type = box_header[4:8]
                    
                    if box_type == b'mvhd':
                        mvhd_data = f.read(box_size - 8)
                        version = mvhd_data[0]
                        if version == 0:
                            timescale = int.from_bytes(mvhd_data[12:16], 'big')
                            duration = int.from_bytes(mvhd_data[16:20], 'big')
                        elif version == 1:
                            timescale = int.from_bytes(mvhd_data[20:24], 'big')
                            duration = int.from_bytes(mvhd_data[24:32], 'big')
                        else:
                            return 0
                        if timescale > 0:
                            return duration / timescale
                    break
                if f.tell() > 15 * 1024 * 1024: # Limita busca nos primeiros 15MB
                    # Tenta ler também os últimos 5MB caso a moov esteja no final
                    f.seek(0, 2)
                    file_size = f.tell()
                    start_pos = max(0, file_size - 5 * 1024 * 1024)
                    f.seek(start_pos)
                    chunk = f.read(5 * 1024 * 1024)
                    idx = chunk.find(b'mvhd')
                    if idx != -1:
                        f.seek(start_pos + idx - 4)
                        box_header = f.read(8)
                        box_size = int.from_bytes(box_header[0:4], 'big')
                        box_type = box_header[4:8]
                        if box_type == b'mvhd':
                            mvhd_data = f.read(box_size - 8)
                            version = mvhd_data[0]
                            if version == 0:
                                timescale = int.from_bytes(mvhd_data[12:16], 'big')
                                duration = int.from_bytes(mvhd_data[16:20], 'big')
                            elif version == 1:
                                timescale = int.from_bytes(mvhd_data[20:24], 'big')
                                duration = int.from_bytes(mvhd_data[24:32], 'big')
                            if timescale > 0:
                                return duration / timescale
                    break
    except Exception:
        pass
    return 0

def obter_duracao_video(caminho_arquivo):
    """
    Retorna a duração do vídeo em minutos.
    Tenta primeiro o parser MP4 nativo, depois o Windows Shell e por fim o tamanho do arquivo como fallback.
    """
    # 1. MP4 Nativo
    duracao_seg = obter_duracao_mp4(caminho_arquivo)
    if duracao_seg > 0:
        return duracao_seg / 60.0
        
    # 2. Windows Shell
    try:
        import win32com.client
        shell = win32com.client.Dispatch("Shell.Application")
        diretorio = os.path.dirname(caminho_arquivo)
        nome_arquivo = os.path.basename(caminho_arquivo)
        folder = shell.NameSpace(diretorio)
        folder_item = folder.ParseName(nome_arquivo)
        
        for idx in [27, 313, 314, 315, 316, 284]:
            detalhe = folder.GetDetailsOf(folder_item, idx)
            if detalhe and ":" in detalhe:
                partes = [int(x) for x in detalhe.split(":") if x.strip().isdigit()]
                if len(partes) == 3:
                    return partes[0] * 60 + partes[1]
                elif len(partes) == 2:
                    return partes[0]
    except:
        pass
        
    # 3. Fallback por tamanho do arquivo (se > 450MB, supõe > 50 min)
    try:
        tamanho_mb = os.path.getsize(caminho_arquivo) / (1024 * 1024)
        if tamanho_mb > 450:
            return 55.0
    except:
        pass
        
    return 0.0

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
    print("💾 Clicado em salvar...")
    
    time.sleep(2)
    
    # 7.1. Se aparecer o pop-up de aviso "Ainda estamos verificando seu conteúdo", clica em "Publicar mesmo assim"
    try:
        botoes_publicar = navegador.find_elements(By.XPATH, "//ytcp-button[contains(., 'Publicar mesmo assim') or contains(., 'Publish anyway')]")
        for btn in botoes_publicar:
            if btn.is_displayed():
                print("⚠️ Aviso de verificação de conteúdo detectado. Clicando em 'Publicar mesmo assim'...")
                try:
                    # Tenta clicar no elemento interno ytSpecTouchFeedbackShapeFill especificado pelo usuário
                    feedback_element = btn.find_element(By.XPATH, ".//div[contains(@class, 'ytSpecTouchFeedbackShapeFill')]")
                    navegador.execute_script("arguments[0].click();", feedback_element)
                except Exception:
                    # Fallback para clicar no próprio botão caso não ache o elemento interno
                    navegador.execute_script("arguments[0].click();", btn)
                time.sleep(2)
                break
    except Exception as e:
        print(f"ℹ️ Sem aviso de verificação de conteúdo ou erro ao tentar clicar: {e}")
        
    time.sleep(1)
    
    # Determina o tempo limite (em segundos) com base na duração do vídeo
    duracao_minutos = obter_duracao_video(caminho_video)
    if duracao_minutos > 50:
        limite_tempo = 900  # 15 minutos
        print(f"🎥 Vídeo longo detectado ({duracao_minutos:.1f} min). Timeout de upload definido para 15 minutos.")
    else:
        limite_tempo = 420  # 7 minutos
        if duracao_minutos > 0:
            print(f"🎥 Vídeo padrão detectado ({duracao_minutos:.1f} min). Timeout de upload definido para 7 minutos.")
        else:
            print(f"🎥 Duração não identificada. Usando timeout padrão de 7 minutos.")
            
    # 8. Aguarda o upload terminar antes de recarregar a página para o próximo vídeo
    print("⏳ Verificando status do upload para não interromper...")
    tempo_espera = 0
    while tempo_espera < limite_tempo:
        try:
            elementos_progresso = navegador.find_elements(By.XPATH, "//ytcp-video-upload-progress")
            visiveis = [el for el in elementos_progresso if el.is_displayed()]
            
            if not visiveis:
                # Se não tem barra de progresso visível, provavelmente fechou e terminou
                break
                
            texto_progresso = visiveis[0].text.lower()
            texto_original = visiveis[0].text.strip()
            
            # Tenta verificar se a barra de progresso do próprio YouTube já está em 100%
            progresso_100 = False
            try:
                barra = visiveis[0].find_element(By.XPATH, ".//tp-yt-paper-progress | .//paper-progress")
                val_attr = barra.get_attribute("value")
                if val_attr and int(val_attr) >= 100:
                    progresso_100 = True
            except:
                pass
            
            # Termos que indicam envio ativo (ainda subindo do computador)
            termos_envio_ativo = [
                "enviando", "uploading", "envio em", "tempo restante", "remaining", 
                "carregando", "faltam", "restante", "loading", "carregados", "carregado"
            ]
            
            subindo = any(term in texto_progresso for term in termos_envio_ativo)
            
            # Se contiver termos de conclusão de envio/processamento ou progresso estiver em 100%
            termos_conclusao = ["concluído", "concluída", "complete", "processando", "processing", "verificações", "checks", "100%", "100 %"]
            concluido = any(term in texto_progresso for term in termos_conclusao) or progresso_100
            
            if subindo and not concluido:
                if tempo_espera % 15 == 0:
                    print(f"   ⬆️ Ainda subindo pro YouTube: {texto_original}")
                time.sleep(5)
                tempo_espera += 5
            else:
                # Pode estar 'processando', 'concluído', etc. O arquivo já subiu.
                print(f"✅ Transferência finalizada! (Status: {texto_original})")
                
                # Tenta fechar o popup residual se houver botão
                try:
                    botoes_fechar = navegador.find_elements(By.XPATH, "//ytcp-button[@id='close-button']")
                    for btn in botoes_fechar:
                        if btn.is_displayed():
                            navegador.execute_script("arguments[0].click();", btn)
                            time.sleep(1)
                            break
                except:
                    pass
                break
        except Exception:
            break
            
    if tempo_espera >= limite_tempo:
        print(f"⚠️ Tempo limite de {limite_tempo // 60} minutos atingido. O YouTube pode ter travado. Forçando prosseguimento para o próximo...")
        
    time.sleep(2)
    
    # Desabilita alertas de navegação (ex: "Descartar alterações") para permitir ir ao próximo
    try:
        navegador.execute_script("window.onbeforeunload = null;")
    except:
        pass
        
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
        
    print(f"✨ Encontrados {total_pendentes} vídeos pendentes.")
    
    # Pergunta ao usuário quantos vídeos deseja enviar
    while True:
        entrada = input(f"❓ Quantos vídeos deseja enviar nesta rodada? (1-{total_pendentes}, ou Pressione Enter para enviar TODOS): ").strip()
        if not entrada:
            limite = total_pendentes
            break
        try:
            limite = int(entrada)
            if 1 <= limite:
                break
            else:
                print(f"❌ Por favor, digite um número maior ou igual a 1.")
        except ValueError:
            print("❌ Entrada inválida. Digite um número inteiro ou pressione Enter.")
            
    if limite < total_pendentes:
        fila_pendente = fila_pendente[:limite]
        total_pendentes = limite
        print(f"ℹ️ Limitando o envio para {limite} vídeos nesta execução.")
    else:
        print(f"🚀 Iniciando envio de todos os {total_pendentes} vídeos pendentes...")
    
    # 3. Inicializa o Chrome somente se houver trabalho a fazer
    navegador = inicializar_navegador()
    
    modo_abertura = 'a' if os.path.exists(ARQUIVO_RESULTADOS) else 'w'
    
    # Determina o último módulo escrito no TXT para saber se precisamos adicionar divisão
    ultimo_modulo_escrito = None
    arquivo_vazio = True
    if os.path.exists(ARQUIVO_TXT):
        try:
            with open(ARQUIVO_TXT, 'r', encoding='utf-8') as f_read:
                linhas = [l.strip() for l in f_read.readlines() if l.strip()]
                if linhas:
                    arquivo_vazio = False
            for linha in reversed(linhas):
                if not (linha.startswith("http://") or linha.startswith("https://") or linha.startswith("www.")):
                    ultimo_modulo_escrito = linha
                    break
        except Exception:
            pass
            
    if modo_abertura == 'w':
        arquivo_vazio = True
        
    try:
        with open(ARQUIVO_RESULTADOS, modo_abertura, newline='', encoding='utf-8') as f, \
             open(ARQUIVO_TXT, modo_abertura, encoding='utf-8') as f_txt:
            
            escritor = csv.writer(f)
            if modo_abertura == 'w':
                escritor.writerow(["nome_aula", "youtube_id", "ordem"])
                
            ultimo_modulo = ultimo_modulo_escrito
            
            for index_original, caminho_video in fila_pendente:
                try:
                    # Trava de Segurança: Fecha abas extras (anúncios, popups)
                    while len(navegador.window_handles) > 1:
                        navegador.switch_to.window(navegador.window_handles[-1])
                        navegador.close()
                    navegador.switch_to.window(navegador.window_handles[0])

                    # Desabilita o alerta de saída por precaução antes de iniciar o upload do próximo vídeo
                    try:
                        navegador.execute_script("window.onbeforeunload = null;")
                    except:
                        pass

                    nome, yt_id = upload_video_youtube(navegador, caminho_video, index_original)
                    
                    if yt_id:
                        # Grava CSV
                        escritor.writerow([nome, yt_id, index_original])
                        f.flush()
                        
                        # Grava TXT
                        # Determina se mudou de módulo/pasta
                        rel_path = os.path.relpath(os.path.dirname(caminho_video), PASTA_VIDEOS)
                        if rel_path != ".":
                            modulo_atual = rel_path.split(os.sep)[0]
                        else:
                            modulo_atual = None
                            
                        if modulo_atual and modulo_atual != ultimo_modulo:
                            # Se o arquivo já tiver conteúdo, adiciona uma linha em branco para separar
                            if not arquivo_vazio:
                                f_txt.write("\n")
                            f_txt.write(f"{modulo_atual}\n")
                            f_txt.flush()
                            ultimo_modulo = modulo_atual
                            arquivo_vazio = False
                            
                        f_txt.write(f"https://youtu.be/{yt_id}\n")
                        f_txt.flush()
                        arquivo_vazio = False
                        
                        print(f"📊 Registrado! Ordem: {index_original} | Link: https://youtu.be/{yt_id}")
                    else:
                        print("⚠️ Erro: Link não capturado.")
                    
                except Exception as e:
                    erro_msg = str(e)
                    print(f"⚠️ Erro no vídeo {os.path.basename(caminho_video)}: {erro_msg}")
                    
                    # Desabilita o alerta de saída para garantir que o script possa recarregar a página no próximo vídeo
                    try:
                        navegador.execute_script("window.onbeforeunload = null;")
                    except:
                        pass
                        
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