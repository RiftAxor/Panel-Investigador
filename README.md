# 🕵️ Panel de Investigación Digital

Un tablero de investigación interactivo al estilo "detective", diseñado para ejecutarse 100% de forma local en tu navegador. Ideal para organizar ideas, conectar pistas, estructurar historias o analizar datos complejos en un lienzo infinito.

---

## 📸 Vistazo al Proyecto

proximamente

---

## ✨ Características Principales

- **Lienzo Infinito:** Explora tus investigaciones sin límites de espacio. Haz zoom in/out y muévete libremente (pan) por el tablero.
- **Múltiples Tipos de Pistas:** Crea tarjetas especializadas para Notas, Personas, Imágenes, Eventos, Enlaces y Líneas de Tiempo.
- **Conexiones Dinámicas:** Une las tarjetas con líneas vectoriales, asigna colores y estilos (sólida/punteada) para indicar la relación entre los elementos.
- **Diseño Moderno:** Interfaz pulida basada en *Glassmorphism* (cristal esmerilado) con soporte para Tema Oscuro y Claro.
- **100% Local y Privado:** No requiere backend ni base de datos. Toda la información se guarda automáticamente en el almacenamiento local de tu navegador.
- **Importación y Exportación:** Guarda tus investigaciones como archivos JSON en tu equipo para compartir o hacer copias de seguridad, y cárgalos cuando los necesites.
- **Personalización y Accesibilidad:** Ajusta el tamaño de la cuadrícula, los grosores de línea, el tamaño del texto, o activa modos de alto contraste y reducción de movimiento directamente desde el menú de ajustes.

## 🚀 Instalación y Uso

Dado que el proyecto no utiliza ningún framework ni requiere de compilación o un servidor backend, probarlo y usarlo es extremadamente sencillo.

### Prerrequisitos
Un navegador web moderno (Chrome, Firefox, Edge, Safari, etc.).

### Instrucciones

1. **Descarga el código:** Clona este repositorio usando git o descarga el archivo ZIP directamente desde GitHub.
   ```bash
   git clone https://github.com/RiftAxor/Panel-Investigador
   ```
2. **Abre la carpeta:** Navega hasta la carpeta del proyecto que acabas de descargar.
3. **Inicia la aplicación:** Simplemente haz doble clic en el archivo `index.html` para abrirlo en tu navegador web predeterminado.
   - *Nota:* Para una mejor experiencia (o si algunas funciones de exportación/importación requieren contexto seguro), puedes usar una extensión como "Live Server" en VSCode o correr un servidor local rápido con Python: `python -m http.server`.
4. **¡Empieza a investigar!** Usa el menú lateral para crear una nueva investigación y el botón flotante (+) para añadir pistas al tablero.

## ⌨️ Controles Rápidos (Teclado)

- **V** - Herramienta de Selección
- **C** - Herramienta para Conectar tarjetas
- **H** - Herramienta para Mover el tablero (Pan)
- **G** - Mostrar/Ocultar cuadrícula
- **S** - Activar/Desactivar ajuste a la cuadrícula (Snap)
- **Espacio (mantener)** - Mover el tablero rápidamente
- **+ / -** - Zoom in y Zoom out
- **0** - Centrar la vista en todas las tarjetas

## 🤖 Sobre el Desarrollo

Este proyecto fue desarrollado y estructurado con **ayuda de Inteligencia Artificial** (AI Coding Assistant), trabajando en conjunto (pair-programming) para diseñar la arquitectura del lienzo interactivo, la lógica de las conexiones SVG, la interfaz Glassmorphism y el sistema de almacenamiento local.

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT. Eres libre de usarlo, modificarlo y distribuirlo.
