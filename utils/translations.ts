import { LanguageCode, Translation, LibraryBook } from "../types";

export const TRANSLATIONS: Record<LanguageCode, Translation> = {
  en: {
    title: "Speed Reader",
    subtitle: "Focus. Read. Learn.",
    pastePlaceholder: "Paste your text here...",
    library: "Library",
    upload: "Upload",
    uploadPlaceholder: "Click to upload a file (.txt, .pdf)",
    uploadFormats: "Supported formats: .txt, .pdf (text-based)",
    processing: "Processing file...",
    fileError: "Error reading file. Please ensure it's a valid text-based file.",
    paste: "Editor",
    start: "Start Reading",
    speed: "Speed",
    size: "Size",
    progress: "Progress",
    tip: "Tip: Press Space to play/pause, R to restart",
    selectLang: "Language",
    emptyState: "Select a book, upload a file, or paste text",
    restart: "Restart",
    fullText: "Full Text",
    hideFullText: "Hide Full Text",
    installPwa: "Install Web App",
    download: "Download App",
    chapters: "Chapters",
    back: "Back",
    verticalMode: "Vertical Text",
    localFiles: "Saved Files",
    delete: "Delete",
    saved: "Saved",
    focusMode: "Focus Mode",
    exitFocus: "Exit Focus",
    wpmLabels: {
      slow: "Slow / Learning",
      normal: "Normal Conversation",
      average: "Average Reader",
      good: "Good Reader",
      fast: "Skimming / Fast",
      speed: "Speed Reader",
      superhuman: "Competitive / Superhuman"
    },
    installModalTitle: "Install Penko Reader",
    installModalDesc: "Install the app for the best experience and offline access.",
    installInstructionsIOS: "1. Tap the Share button (square with arrow)\n2. Scroll down and select 'Add to Home Screen'\n3. Tap 'Add' in the top right",
    installInstructionsAndroid: "1. Tap the browser menu (three dots icon)\n2. Select Install App or Add to Home Screen\n3. Follow the on-screen prompt to confirm",
    installInstructionsDesktop: "Download the offline-capable app for your computer.",
    onMobile: "On a mobile device? Click here.",
    close: "Close"
  },
  es: {
    title: "Lectura Rápida",
    subtitle: "Enfoque. Leer. Aprender.",
    pastePlaceholder: "Pega tu texto aquí...",
    library: "Biblioteca",
    upload: "Subir",
    uploadPlaceholder: "Click para subir archivo (.txt, .pdf)",
    uploadFormats: "Formatos soportados: .txt, .pdf (texto)",
    processing: "Procesando archivo...",
    fileError: "Error al leer el archivo. Asegúrate de que sea válido.",
    paste: "Editor",
    start: "Comenzar",
    speed: "Velocidad",
    size: "Tamaño",
    progress: "Progreso",
    tip: "Consejo: Espacio para pausar, R para reiniciar",
    selectLang: "Idioma",
    emptyState: "Selecciona un libro o pega texto",
    restart: "Reiniciar",
    fullText: "Texto Completo",
    hideFullText: "Ocultar Texto",
    installPwa: "Instalar Web",
    download: "Descargar App",
    chapters: "Capítulos",
    back: "Atrás",
    verticalMode: "Texto Vertical",
    localFiles: "Archivos Guardados",
    delete: "Borrar",
    saved: "Guardado",
    focusMode: "Modo Enfoque",
    exitFocus: "Salir",
    wpmLabels: {
      slow: "Lento / Aprendizaje",
      normal: "Conversación Normal",
      average: "Lector Promedio",
      good: "Buen Lector",
      fast: "Rápido",
      speed: "Lectura Rápida",
      superhuman: "Competitivo / Sobrehumano"
    },
    installModalTitle: "Instalar Penko Reader",
    installModalDesc: "Instala la app para la mejor experiencia y acceso sin conexión.",
    installInstructionsIOS: "1. Toca el botón Compartir (cuadrado con flecha)\n2. Desplázate y selecciona 'Agregar a Inicio'\n3. Toca 'Agregar' arriba a la derecha",
    installInstructionsAndroid: "1. Toca el menú del navegador (tres puntos)\n2. Selecciona Instalar App o Agregar a Inicio\n3. Sigue las instrucciones para confirmar",
    installInstructionsDesktop: "Descarga la aplicación para tu computadora.",
    onMobile: "¿En un dispositivo móvil? Clic aquí.",
    close: "Cerrar"
  },
  fr: {
    title: "Lecture Rapide",
    subtitle: "Concentration. Lire. Apprendre.",
    pastePlaceholder: "Collez votre texte ici...",
    library: "Bibliothèque",
    upload: "Télécharger",
    uploadPlaceholder: "Cliquez pour télécharger (.txt, .pdf)",
    uploadFormats: "Formats: .txt, .pdf (texte)",
    processing: "Traitement du fichier...",
    fileError: "Erreur de lecture du fichier.",
    paste: "Éditeur",
    start: "Commencer",
    speed: "Vitesse",
    size: "Taille",
    progress: "Progrès",
    tip: "Astuce: Espace pour lire/pause, R pour redémarrer",
    selectLang: "Langue",
    emptyState: "Sélectionnez un livre ou collez du texte",
    restart: "Redémarrer",
    fullText: "Texte Complet",
    hideFullText: "Masquer le texte",
    installPwa: "Installer Web",
    download: "Télécharger",
    chapters: "Chapitres",
    back: "Retour",
    verticalMode: "Texte Vertical",
    localFiles: "Fichiers",
    delete: "Supprimer",
    saved: "Enregistré",
    focusMode: "Mode Focus",
    exitFocus: "Quitter",
    wpmLabels: {
      slow: "Lent / Apprentissage",
      normal: "Conversation",
      average: "Lecteur Moyen",
      good: "Bon Lecteur",
      fast: "Rapide",
      speed: "Lecture Rapide",
      superhuman: "Surhumain"
    },
    installModalTitle: "Installer Penko Reader",
    installModalDesc: "Installez l'application pour une meilleure expérience et un accès hors ligne.",
    installInstructionsIOS: "1. Appuyez sur le bouton Partager (carré avec flèche)\n2. Faites défiler et sélectionnez 'Sur l'écran d'accueil'\n3. Appuyez sur 'Ajouter' en haut à droite",
    installInstructionsAndroid: "1. Appuyez sur le menu du navigateur (trois points)\n2. Sélectionnez Installer l'application ou Ajouter à l'écran d'accueil\n3. Suivez les instructions pour confirmer",
    installInstructionsDesktop: "Téléchargez l'application hors ligne pour votre ordinateur.",
    onMobile: "Sur un appareil mobile ? Cliquez ici.",
    close: "Fermer"
  },
  de: {
    title: "Schnelles Lesen",
    subtitle: "Fokus. Lesen. Lernen.",
    pastePlaceholder: "Fügen Sie hier Ihren Text ein...",
    library: "Bibliothek",
    upload: "Hochladen",
    uploadPlaceholder: "Datei hochladen (.txt, .pdf)",
    uploadFormats: "Formate: .txt, .pdf (Text)",
    processing: "Datei wird verarbeitet...",
    fileError: "Fehler beim Lesen der Datei.",
    paste: "Editor",
    start: "Starten",
    speed: "Tempo",
    size: "Größe",
    progress: "Fortschritt",
    tip: "Tipp: Leertaste für Start/Pause, R für Neustart",
    selectLang: "Sprache",
    emptyState: "Wählen Sie ein Buch",
    restart: "Neustart",
    fullText: "Volltext",
    hideFullText: "Text verbergen",
    installPwa: "Web-App installieren",
    download: "App herunterladen",
    chapters: "Kapitel",
    back: "Zurück",
    verticalMode: "Vertikaler Text",
    localFiles: "Gespeicherte",
    delete: "Löschen",
    saved: "Gespeichert",
    focusMode: "Fokusmodus",
    exitFocus: "Beenden",
    wpmLabels: {
      slow: "Langsam",
      normal: "Normal",
      average: "Durchschnitt",
      good: "Gut",
      fast: "Schnell",
      speed: "Sehr Schnell",
      superhuman: "Übermenschlich"
    },
    installModalTitle: "Penko Reader installieren",
    installModalDesc: "Installieren Sie die App für das beste Erlebnis und Offline-Zugriff.",
    installInstructionsIOS: "1. Tippen Sie auf Teilen (Quadrat mit Pfeil)\n2. Scrollen Sie und wählen Sie 'Zum Home-Bildschirm'\n3. Tippen Sie oben rechts auf 'Hinzufügen'",
    installInstructionsAndroid: "1. Tippen Sie auf das Browser-Menü (drei Punkte)\n2. Wählen Sie App installieren oder Zum Startbildschirm hinzufügen\n3. Folgen Sie den Anweisungen",
    installInstructionsDesktop: "Laden Sie die Offline-App für Ihren Computer herunter.",
    onMobile: "Auf einem mobilen Gerät? Hier klicken.",
    close: "Schließen"
  },
  ja: {
    title: "速読",
    subtitle: "集中。読む。学ぶ。",
    pastePlaceholder: "テキストをここに貼り付けてください...",
    library: "ライブラリ",
    upload: "アップロード",
    uploadPlaceholder: "ファイルをアップロード (.txt, .pdf)",
    uploadFormats: "対応形式: .txt, .pdf (テキスト)",
    processing: "処理中...",
    fileError: "ファイル読み込みエラー。",
    paste: "エディタ",
    start: "読み始める",
    speed: "速度",
    size: "サイズ",
    progress: "進捗",
    tip: "ヒント: スペースキーで再生/一時停止",
    selectLang: "言語",
    emptyState: "本を選択するか、テキストを貼り付けてください",
    restart: "リスタート",
    fullText: "全文",
    hideFullText: "全文を隠す",
    installPwa: "アプリをインストール",
    download: "ダウンロード",
    chapters: "章",
    back: "戻る",
    verticalMode: "縦書き",
    localFiles: "保存されたファイル",
    delete: "削除",
    saved: "保存済み",
    focusMode: "集中モード",
    exitFocus: "終了",
    wpmLabels: {
      slow: "遅い / 学習",
      normal: "会話速度",
      average: "平均的",
      good: "良い",
      fast: "速い",
      speed: "速読",
      superhuman: "超人的"
    },
    installModalTitle: "Penko Readerをインストール",
    installModalDesc: "最高の体験とオフラインアクセスのためにアプリをインストールしてください。",
    installInstructionsIOS: "1. 共有ボタン（矢印付きの四角）をタップ\n2. スクロールして「ホーム画面に追加」を選択\n3. 右上の「追加」をタップ",
    installInstructionsAndroid: "1. ブラウザメニュー（3つの点）をタップ\n2. 「アプリをインストール」または「ホーム画面に追加」を選択\n3. 画面の指示に従って確認",
    installInstructionsDesktop: "コンピュータ用のオフライン対応アプリをダウンロード。",
    onMobile: "モバイルデバイスですか？ここをクリック。",
    close: "閉じる"
  },
  ru: {
    title: "Скорочтение",
    subtitle: "Фокус. Читать. Учиться.",
    pastePlaceholder: "Вставьте текст здесь...",
    library: "Библиотека",
    upload: "Загрузить",
    uploadPlaceholder: "Нажмите для загрузки (.txt, .pdf)",
    uploadFormats: "Форматы: .txt, .pdf (текст)",
    processing: "Обработка файла...",
    fileError: "Ошибка чтения файла.",
    paste: "Редактор",
    start: "Начать",
    speed: "Скорость",
    size: "Размер",
    progress: "Прогресс",
    tip: "Совет: Пробел для паузы, R для перезапуска",
    selectLang: "Язык",
    emptyState: "Выберите книгу или вставьте текст",
    restart: "Заново",
    fullText: "Весь текст",
    hideFullText: "Скрыть текст",
    installPwa: "Установить Web",
    download: "Скачать",
    chapters: "Главы",
    back: "Назад",
    verticalMode: "Вертикальный текст",
    localFiles: "Сохраненные",
    delete: "Удалить",
    saved: "Сохранено",
    focusMode: "Фокус",
    exitFocus: "Выйти",
    wpmLabels: {
      slow: "Медленно",
      normal: "Нормально",
      average: "Средний уровень",
      good: "Хороший уровень",
      fast: "Быстро",
      speed: "Скорочтение",
      superhuman: "Сверхчеловек"
    },
    installModalTitle: "Установить Penko Reader",
    installModalDesc: "Установите приложение для лучшей работы и офлайн-доступа.",
    installInstructionsIOS: "1. Нажмите кнопку Поделиться (квадрат со стрелкой)\n2. Прокрутите и выберите 'На экран «Домой»'\n3. Нажмите 'Добавить' в правом верхнем углу",
    installInstructionsAndroid: "1. Нажмите меню браузера (три точки)\n2. Выберите Установить приложение или Добавить на гл. экран\n3. Следуйте инструкциям на экране",
    installInstructionsDesktop: "Скачайте офлайн-приложение для вашего компьютера.",
    onMobile: "На мобильном устройстве? Нажмите здесь.",
    close: "Закрыть"
  },
  uk: {
    title: "Швидкочитання",
    subtitle: "Фокус. Читати. Вчитися.",
    pastePlaceholder: "Вставте текст тут...",
    library: "Бібліотека",
    upload: "Завантажити",
    uploadPlaceholder: "Натисніть для завантаження (.txt, .pdf)",
    uploadFormats: "Формати: .txt, .pdf (текст)",
    processing: "Обробка файлу...",
    fileError: "Помилка читання файлу.",
    paste: "Редактор",
    start: "Почати",
    speed: "Швидкість",
    size: "Розмір",
    progress: "Прогрес",
    tip: "Порада: Пробіл для паузи, R для перезапуску",
    selectLang: "Мова",
    emptyState: "Виберіть книгу або вставте текст",
    restart: "Заново",
    fullText: "Весь текст",
    hideFullText: "Сховати текст",
    installPwa: "Встановити Web",
    download: "Завантажити",
    chapters: "Розділи",
    back: "Назад",
    verticalMode: "Вертикальний текст",
    localFiles: "Збережені",
    delete: "Видалити",
    saved: "Збережено",
    focusMode: "Фокус",
    exitFocus: "Вийти",
    wpmLabels: {
      slow: "Повільно",
      normal: "Нормально",
      average: "Середній рівень",
      good: "Хороший рівень",
      fast: "Швидко",
      speed: "Швидкочитання",
      superhuman: "Надлюдина"
    },
    installModalTitle: "Встановити Penko Reader",
    installModalDesc: "Встановіть додаток для найкращого досвіду та офлайн-доступу.",
    installInstructionsIOS: "1. Натисніть кнопку Поділитися (квадрат зі стрілкою)\n2. Прокрутіть і виберіть 'На початковий екран'\n3. Натисніть 'Додати' у верхньому правому куті",
    installInstructionsAndroid: "1. Натисніть меню браузера (три крапки)\n2. Виберіть Встановити додаток або Додати на гол. екран\n3. Дотримуйтесь інструкцій на екрані",
    installInstructionsDesktop: "Завантажте офлайн-додаток для вашого комп'ютера.",
    onMobile: "На мобільному пристрої? Натисніть тут.",
    close: "Закрити"
  },
  it: {
    title: "Lettura Veloce",
    subtitle: "Focus. Leggere. Imparare.",
    pastePlaceholder: "Incolla il testo qui...",
    library: "Biblioteca",
    upload: "Caricare",
    uploadPlaceholder: "Clicca per caricare (.txt, .pdf)",
    uploadFormats: "Formati: .txt, .pdf (testo)",
    processing: "Elaborazione file...",
    fileError: "Errore di lettura del file.",
    paste: "Editor",
    start: "Inizia",
    speed: "Velocità",
    size: "Dimensione",
    progress: "Progresso",
    tip: "Consiglio: Spazio per pausa, R per riavviare",
    selectLang: "Lingua",
    emptyState: "Seleziona un libro o incolla il testo",
    restart: "Ricomincia",
    fullText: "Testo Completo",
    hideFullText: "Nascondi testo",
    installPwa: "Installa Web",
    download: "Scarica App",
    chapters: "Capitoli",
    back: "Indietro",
    verticalMode: "Testo Verticale",
    localFiles: "File Salvati",
    delete: "Elimina",
    saved: "Salvato",
    focusMode: "Modalità Focus",
    exitFocus: "Esci",
    wpmLabels: {
      slow: "Lento",
      normal: "Normale",
      average: "Medio",
      good: "Buono",
      fast: "Veloce",
      speed: "Lettura Veloce",
      superhuman: "Sovrumano"
    },
    installModalTitle: "Installa Penko Reader",
    installModalDesc: "Installa l'app per la migliore esperienza e l'accesso offline.",
    installInstructionsIOS: "1. Tocca il pulsante Condividi (quadrato con freccia)\n2. Scorri e seleziona 'Aggiungi alla schermata Home'\n3. Tocca 'Aggiungi' in alto a destra",
    installInstructionsAndroid: "1. Tocca il menu del browser (tre puntini)\n2. Seleziona Installa app o Aggiungi a schermata Home\n3. Segui le istruzioni per confermare",
    installInstructionsDesktop: "Scarica l'app offline per il tuo computer.",
    onMobile: "Su un dispositivo mobile? Clicca qui.",
    close: "Chiudi"
  },
  pt: {
    title: "Leitura Rápida",
    subtitle: "Foco. Ler. Aprender.",
    pastePlaceholder: "Cole seu texto aqui...",
    library: "Biblioteca",
    upload: "Carregar",
    uploadPlaceholder: "Clique para carregar (.txt, .pdf)",
    uploadFormats: "Formatos: .txt, .pdf (texto)",
    processing: "Processando arquivo...",
    fileError: "Erro ao ler arquivo.",
    paste: "Editor",
    start: "Começar",
    speed: "Velocidade",
    size: "Tamanho",
    progress: "Progresso",
    tip: "Dica: Espaço para pausar, R para reiniciar",
    selectLang: "Idioma",
    emptyState: "Selecione um livro ou cole o texto",
    restart: "Reiniciar",
    fullText: "Texto Completo",
    hideFullText: "Ocultar texto",
    installPwa: "Instalar Web",
    download: "Baixar App",
    chapters: "Capítulos",
    back: "Voltar",
    verticalMode: "Texto Vertical",
    localFiles: "Arquivos Salvos",
    delete: "Excluir",
    saved: "Salvo",
    focusMode: "Modo Foco",
    exitFocus: "Sair",
    wpmLabels: {
      slow: "Lento",
      normal: "Normal",
      average: "Médio",
      good: "Bom",
      fast: "Rápido",
      speed: "Leitura Rápida",
      superhuman: "Sobre-humano"
    },
    installModalTitle: "Instalar Penko Reader",
    installModalDesc: "Instale o aplicativo para a melhor experiência e acesso offline.",
    installInstructionsIOS: "1. Toque no botão Compartilhar (quadrado com seta)\n2. Role e selecione 'Adicionar à Tela de Início'\n3. Toque em 'Adicionar' no canto superior direito",
    installInstructionsAndroid: "1. Toque no menu do navegador (três pontos)\n2. Selecione Instalar App ou Adicionar à Tela Inicial\n3. Siga as instruções para confirmar",
    installInstructionsDesktop: "Baixe o aplicativo offline para o seu computador.",
    onMobile: "Em um dispositivo móvel? Clique aqui.",
    close: "Fechar"
  },
  zh: {
    title: "快速阅读",
    subtitle: "专注。阅读。学习。",
    pastePlaceholder: "在此粘贴文本...",
    library: "图书馆",
    upload: "上传",
    uploadPlaceholder: "点击上传文件 (.txt, .pdf)",
    uploadFormats: "支持格式：.txt, .pdf (文本)",
    processing: "正在处理文件...",
    fileError: "文件读取错误。",
    paste: "编辑器",
    start: "开始阅读",
    speed: "速度",
    size: "字体",
    progress: "进度",
    tip: "提示：空格键暂停/播放，R键重置",
    selectLang: "语言",
    emptyState: "选择一本书或粘贴文本",
    restart: "重启",
    fullText: "全文",
    hideFullText: "隐藏全文",
    installPwa: "安装 Web 应用",
    download: "下载应用",
    chapters: "章节",
    back: "返回",
    verticalMode: "竖排文本",
    localFiles: "已保存文件",
    delete: "删除",
    saved: "已保存",
    focusMode: "专注模式",
    exitFocus: "退出",
    wpmLabels: {
      slow: "慢速",
      normal: "正常",
      average: "平均",
      good: "良好",
      fast: "快速",
      speed: "速读",
      superhuman: "超人"
    },
    installModalTitle: "安装 Penko Reader",
    installModalDesc: "安装应用程序以获得最佳体验和离线访问。",
    installInstructionsIOS: "1. 点击分享按钮（带箭头的方块）\n2. 向下滚动并选择“添加到主屏幕”\n3. 点击右上角的“添加”",
    installInstructionsAndroid: "1. 点击浏览器菜单（三个点图标）\n2. 选择安装应用或添加到主屏幕\n3. 按照屏幕提示进行确认",
    installInstructionsDesktop: "下载适用于您计算机的离线应用程序。",
    onMobile: "在移动设备上？点击这里。",
    close: "关闭"
  }
};

export const LIBRARY: Record<LanguageCode, LibraryBook[]> = {
  en: [
    {
      title: "The Great Gatsby",
      author: "F. Scott Fitzgerald",
      chapters: [
        {
          title: "Chapter 1 (Excerpt)",
          text: "In my younger and more vulnerable years my father gave me some advice that I've been turning over in my mind ever since.\n\n'Whenever you feel like criticizing any one,' he told me, 'just remember that all the people in this world haven't had the advantages that you've had.'\n\nHe didn't say any more, but we've always been unusually communicative in a reserved way, and I understood that he meant a great deal more than that. In consequence, I'm inclined to reserve all judgments, a habit that has opened up many curious natures to me and also made me the victim of not a few veteran bores."
        },
        {
          title: "Chapter 2 (Excerpt)",
          text: "About half way between West Egg and New York the motor road hastily joins the railroad and runs beside it for a quarter of a mile, so as to shrink away from a certain desolate area of land. This is a valley of ashes—a fantastic farm where ashes grow like wheat into ridges and hills and grotesque gardens; where ashes take the forms of houses and chimneys and rising smoke and, finally, with a transcendent effort, of men who move dimly and already crumbling through the powdery air."
        }
      ]
    },
    {
      title: "Moby Dick",
      author: "Herman Melville",
      chapters: [
         {
          title: "Chapter 1: Loomings",
          text: "Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way I have of driving off the spleen and regulating the circulation. Whenever I find myself growing grim about the mouth; whenever it is a damp, drizzly November in my soul."
        }
      ]
    }
  ],
  es: [
    {
      title: "Don Quijote",
      author: "Miguel de Cervantes",
      chapters: [
        {
          title: "Capítulo 1",
          text: "En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un hidalgo de los de lanza en astillero, adarga antigua, rocín flaco y galgo corredor.\n\nUna olla de algo más vaca que carnero, salpicón las más noches, duelos y quebrantos los sábados, lantejas los viernes, algún palomino de añadidura los domingos, consumían las tres partes de su hacienda."
        }
      ]
    }
  ],
  fr: [
    {
      title: "L'Étranger",
      author: "Albert Camus",
      chapters: [
        {
           title: "Première Partie",
           text: "Aujourd'hui, maman est morte. Ou peut-être hier, je ne sais pas. J'ai reçu un télégramme de l'asile : « Mère décédée. Enterrement demain. Sentiments distingués. » Cela ne veut rien dire. C'était peut-être hier."
        }
      ]
    }
  ],
  de: [
    {
      title: "Die Verwandlung",
      author: "Franz Kafka",
      chapters: [
        {
           title: "Teil I",
           text: "Als Gregor Samsa eines Morgens aus unruhigen Träumen erwachte, fand er sich in seinem Bett zu einem ungeheuren Ungeziefer verwandelt. Er lag auf seinem panzerartig harten Rücken und sah, wenn er den Kopf ein wenig hob, seinen gewölbten, braunen, von bogenförmigen Versteifungen geteilten Bauch."
        }
      ]
    }
  ],
  ja: [
    {
      title: "吾輩は猫である",
      author: "夏目 漱石",
      chapters: [
        {
           title: "第一章",
           text: "吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。吾輩はここで始めて人間というものを見た。しかもあとで聞くとそれは書生という人間中で一番獰悪な種族であったそうだ。"
        }
      ]
    }
  ],
  ru: [
    {
      title: "Анна Каренина",
      author: "Лев Толстой",
      chapters: [
        {
          title: "Часть 1",
          text: "Все счастливые семьи похожи друг на друга, каждая несчастливая семья несчастлива по-своему. Все смешалось в доме Облонских."
        }
      ]
    }
  ],
  uk: [
    {
      title: "Кобзар",
      author: "Тарас Шевченко",
      chapters: [
        {
          title: "Заповіт",
          text: "Як умру, то поховайте Мене на могилі Серед степу широкого На Вкраїні милій..."
        }
      ]
    }
  ],
  it: [
    {
      title: "Divina Commedia",
      author: "Dante Alighieri",
      chapters: [
        {
          title: "Inferno - Canto I",
          text: "Nel mezzo del cammin di nostra vita mi ritrovai per una selva oscura, ché la diritta via era smarrita."
        }
      ]
    }
  ],
  pt: [
    {
      title: "Dom Casmurro",
      author: "Machado de Assis",
      chapters: [
        {
          title: "Capítulo I",
          text: "Uma noite destas, vindo da cidade para o Engenho Novo, encontrei no trem da Central um rapaz aqui do bairro, que eu conheço de vista e de chapéu."
        }
      ]
    },
  ],
  zh: [
    {
      title: "狂人日记",
      author: "鲁迅",
      chapters: [
        {
           title: "第一节",
           text: "今天晚上，很好的月光。我不见他，已是三十多年；今天见了，精神分外爽快。才知道以前的三十多年，全是发昏；然而须十分小心。"
        }
      ]
    }
  ]
};
