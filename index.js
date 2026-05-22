const video = document.getElementById('camera')
const photos = document.getElementById('photos')
const overlay = document.getElementById('overlay')
const overlayCtx = overlay.getContext('2d')

let currentAcessorio = 'nenhum';
let lastDetections = null;
let isProcessing = false;

// ==========================================================================
// 1. CARREGAMENTO DOS 4 PNGs (Pasta: fotos/)
// ==========================================================================
const imgAcessorios = {
    hello: new Image(),
    morango: new Image(),
    bigode: new Image(),
    cachorro: new Image() 
};

imgAcessorios.hello.src = 'fotos/foto1.png';   
imgAcessorios.morango.src = 'fotos/foto2.png'; 
imgAcessorios.bigode.src = 'fotos/foto3.png';  
imgAcessorios.cachorro.src = 'fotos/foto4.png'; 

function setAcessorio(tipo) {
    currentAcessorio = tipo;
    // Se limpar o filtro, já limpa a tela imediatamente
    if (tipo === 'nenhum') {
        overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
    }
    console.log("Filtro alterado para:", tipo);
}

// ==========================================================================
// 2. LIGAR A CÂMERA IMEDIATAMENTE
// ==========================================================================
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        video.srcObject = stream
        
        video.onloadedmetadata = () => {
            arrumarTamanhoCanvas();
            initFaceAPI();
        };
    } catch (error) {
        alert('Erro ao acessar câmera: ' + error.message)
    }
}

function arrumarTamanhoCanvas() {
    if (video.offsetWidth > 0) {
        overlay.width = video.offsetWidth;
        overlay.height = video.offsetHeight;
    }
}
window.addEventListener('resize', arrumarTamanhoCanvas);

// ==========================================================================
// 3. CAPTURAR FOTO (Alinhamento perfeito com o espelhamento da tela)
// ==========================================================================
function capturarPhoto(efeito) {
    const photo = document.createElement('canvas')
    photo.width = video.videoWidth
    photo.height = video.videoHeight

    const context = photo.getContext('2d')

    context.save();
    context.translate(photo.width, 0)
    context.scale(-1, 1)

    switch (efeito) {
        case 'cinza':
            context.filter = 'grayscale(100%)'
            break;
        case 'antiga':
            context.filter = 'sepia(100%)'
            break;
        case 'desfoque':
            context.filter = 'blur(3px)'
            break;
        case 'brilho':
            context.filter = 'brightness(150%)'
            break;
        case 'saturacao':
            context.filter = 'saturate(200%)'
            break;
        case 'opacity':
            context.filter = 'opacity(50%)'
            break;
        case 'inverter':
            context.scale(1, -1)
            context.translate(0, -photo.height)
            break;
    }

    context.drawImage(video, 0, 0, photo.width, photo.height)
    context.restore(); 

    if (currentAcessorio !== 'nenhum' && lastDetections) {
        context.save();
        
        context.translate(photo.width, 0);
        context.scale(-1, 1);
        
        const scaleX = photo.width / video.offsetWidth;
        const scaleY = photo.height / video.offsetHeight;
        
        desenharAcessorioNoContexto(context, lastDetections, scaleX, scaleY);
        context.restore();
    }

    photos.appendChild(photo)
}

// ==========================================================================
// 4. INICIALIZAÇÃO DA FACE-API E SINCRONIA TOTAL (SEM ATRASO)
// ==========================================================================
async function initFaceAPI() {
    const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';
    
    try {
        await faceapi.loadTinyFaceDetectorModel(MODEL_URL);
        await faceapi.loadFaceLandmarkModel(MODEL_URL);
        console.log("IA Pronta! Sincronia de hardware ativada. ⚡");
        
        // Inicia o loop usando a própria execução estável do navegador
        requestAnimationFrame(rodarDeteccao);
    } catch (e) {
        console.error("Aviso: Falha ao carregar os modelos da IA.", e);
    }
}

async function rodarDeteccao() {
    // Evita acumular requisições se a IA ainda estiver processando o frame anterior
    if (video.paused || video.ended || isProcessing) {
        requestAnimationFrame(rodarDeteccao);
        return;
    }

    isProcessing = true;
    const detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 128, scoreThreshold: 0.4 });

    try {
        const detection = await faceapi.detectSingleFace(video, detectorOptions).withFaceLandmarks();

        if (detection) {
            const displaySize = { width: overlay.width, height: overlay.height };
            const resizedDetections = faceapi.resizeResults(detection, displaySize);
            lastDetections = resizedDetections;

            // CRITICO: Só limpa e redesenha a tela no exato instante em que a posição foi calculada
            overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
            if (currentAcessorio !== 'nenhum') {
                desenharAcessorioNoContexto(overlayCtx, resizedDetections, 1, 1);
            }
        } else {
            // Se não detectou rosto, limpa o acessório antigo da tela para não ficar travado no ar
            overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
            lastDetections = null;
        }
    } catch (err) {
        console.blackhole = err;
    }

    isProcessing = false;
    requestAnimationFrame(rodarDeteccao);
}

// ==========================================================================
// 5. RENDERIZADOR DOS ACESSÓRIOS (POSIÇÃO E ALTURA CALIBRADAS)
// ==========================================================================
function desenharAcessorioNoContexto(ctx, landmarksData, sX, sY) {
    const landmarks = landmarksData.landmarks;
    const img = imgAcessorios[currentAcessorio];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const jaw = landmarks.getJawOutline(); 
    const nose = landmarks.getNose(); 
    const mouth = landmarks.getMouth(); 

    // Largura real calculada do rosto
    const larguraRosto = Math.abs(jaw[16].x - jaw[0].x) * sX;
    
    // Centro absoluto baseado no osso nasal (Ponto estável 3)
    const centroX = nose[3].x * sX;
    const centroY = nose[3].y * sY;

    if (currentAcessorio === 'hello') {
        const faceWidth = larguraRosto * 2.1; 
        const faceHeight = faceWidth * (img.naturalHeight / img.naturalWidth);
        const helloCentroY = centroY - (faceWidth * 0.08); 

        const x = centroX - (faceWidth / 2);
        const y = helloCentroY - (faceHeight * 0.55); 
        ctx.drawImage(img, x, y, faceWidth, faceHeight);

    } else if (currentAcessorio === 'morango') {
        const faceWidth = larguraRosto * 2.1; 
        const faceHeight = faceWidth * (img.naturalHeight / img.naturalWidth);
        
        const x = centroX - (faceWidth / 2);
        const y = centroY - (faceHeight * 0.55); 
        ctx.drawImage(img, x, y, faceWidth, faceHeight);

    } else if (currentAcessorio === 'bigode') {
        const baseNariz = nose[6]; 
        const topoLabio = mouth[3]; 

        const mustacheWidth = larguraRosto * 0.75;
        const alturaBigode = mustacheWidth * (img.naturalHeight / img.naturalWidth);

        const x = (baseNariz.x * sX) - (mustacheWidth / 2);
        const meioEspacoY = ((baseNariz.y + topoLabio.y) / 2) * sY;
        const y = meioEspacoY - (alturaBigode / 2);
        ctx.drawImage(img, x, y, mustacheWidth, alturaBigode);

    } else if (currentAcessorio === 'cachorro') {
        // --- CACHORRINHO SUBIDO UM POUQUINHO PARA O LUGAR CERTO ---
        const dogWidth = larguraRosto * 1.7; 
        const dogHeight = dogWidth * (img.naturalHeight / img.naturalWidth);

        const x = centroX - (dogWidth / 2);
        
        // Mudado o multiplicador de altura de 0.52 para 0.58 para subir sutilmente o focinho e as orelhas
        const y = (nose[1].y * sY) - (dogHeight * 0.58); 

        ctx.drawImage(img, x, y, dogWidth, dogHeight);
    }
}

startCamera();