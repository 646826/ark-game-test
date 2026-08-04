import type { SupportedLanguage } from '../core/types.js';

const en = {
  continue: 'Continue', campaign: 'Campaign', daily: 'Daily Bloom', zen: 'Zen Garden',
  restoration: 'Restoration progress', specimens: 'Specimen collection', bestScore: 'Best score',
  streak: 'Current streak', chamberProgress: 'Chamber progress', continueRestoration: 'Continue restoration',
  playNow: 'Play now', undo: 'Undo', hint: 'Garden Hint', rotateView: 'Rotate view', restart: 'Restart',
  menu: 'Menu', level: 'Level', score: 'Score', moves: 'Moves', blooms: 'Blooms', leaks: 'Leaks sealed',
  glasshouseRestored: 'Glasshouse Restored', nextLevel: 'Next level', replay: 'Replay', returnMenu: 'Return to menu',
  newSpecimen: 'New specimen unlocked', settings: 'Settings', help: 'How to play', resume: 'Resume',
  sound: 'Sound effects', music: 'Ambient music', reducedMotion: 'Reduce motion', highContrast: 'High contrast',
  quality: 'Visual quality', language: 'Language', close: 'Close', pauseTitle: 'The glasshouse is paused',
  noHint: 'The circuit is already aligned.', adUnavailable: 'A rewarded hint is not available right now.',
  fixed: 'This mechanism is anchored.', undoEmpty: 'There is nothing to undo.',
  hintThinking: 'The garden keeper is tracing the current…',
  hintInstruction: 'Rotate row {row}, column {column} {turns}.', once: 'once', twice: 'twice', threeTimes: 'three times',
  howTitle: 'Restore the Bloom Circuit',
  howBody: 'Rotate each mechanism until every flower receives aetherlight and every powered leak is sealed.',
  howOne: 'Tap or click a mechanism to rotate it clockwise.',
  howTwo: 'Luminous turquoise channels are powered by the Sunwell.',
  howThree: 'Red markers show active leaks; brass locks show anchored pieces.',
  mapTitle: 'Restoration Map', mapBody: 'Reconnect every chamber and return the living glasshouse to splendour.',
  dailyReady: 'New puzzle available', dayStreak: 'days in a row', loading: 'Opening the conservatory…',
  campaignSub: 'Restore chambers and unlock rare blooms.', dailySub: 'One daily seed shared by every player.',
  zenSub: 'Relax in an untimed endless garden.', tagline: 'Reconnect the aetherlight. Awaken every bloom.',
  objectiveLeak: '{blooms} blooms awake · {leaks} active {leakWord}', objectiveClear: '{blooms} blooms awake · no active leaks',
  newRecord: 'New record', leaderboardUpdated: 'Leaderboard updated', masterwork: 'Masterwork circuit',
  current: 'Current', locked: 'Locked', complete: 'Complete',
} as const;

export type TranslationKey = keyof typeof en;
type TranslationTable = Partial<Record<TranslationKey, string>>;

const translations: Record<SupportedLanguage, TranslationTable> = {
  en,
  es: {
    continue: 'Continuar', campaign: 'Campaña', daily: 'Flor diaria', zen: 'Jardín zen',
    restoration: 'Progreso de restauración', specimens: 'Colección botánica', bestScore: 'Mejor puntuación',
    streak: 'Racha actual', chamberProgress: 'Progreso de cámaras', continueRestoration: 'Continuar restauración',
    playNow: 'Jugar', undo: 'Deshacer', hint: 'Pista del jardín', rotateView: 'Girar vista', restart: 'Reiniciar',
    menu: 'Menú', level: 'Nivel', score: 'Puntos', moves: 'Movimientos', blooms: 'Flores', leaks: 'Fugas selladas',
    glasshouseRestored: 'Invernadero restaurado', nextLevel: 'Siguiente nivel', replay: 'Repetir',
    returnMenu: 'Volver al menú', settings: 'Ajustes', help: 'Cómo jugar', resume: 'Continuar', close: 'Cerrar',
    loading: 'Abriendo el invernadero…', tagline: 'Reconecta la luz. Despierta cada flor.',
  },
  fr: {
    continue: 'Continuer', campaign: 'Campagne', daily: 'Floraison du jour', zen: 'Jardin zen',
    restoration: 'Progression', specimens: 'Collection botanique', bestScore: 'Meilleur score', streak: 'Série actuelle',
    continueRestoration: 'Continuer la restauration', playNow: 'Jouer', undo: 'Annuler', hint: 'Indice du jardin',
    restart: 'Recommencer', menu: 'Menu', level: 'Niveau', score: 'Score', moves: 'Coups', blooms: 'Fleurs',
    leaks: 'Fuites colmatées', glasshouseRestored: 'Serre restaurée', nextLevel: 'Niveau suivant', replay: 'Rejouer',
    returnMenu: 'Retour au menu', settings: 'Réglages', help: 'Comment jouer', resume: 'Reprendre', close: 'Fermer',
    loading: 'Ouverture de la serre…', tagline: 'Reconnectez la lumière. Éveillez chaque fleur.',
  },
  de: {
    continue: 'Fortsetzen', campaign: 'Kampagne', daily: 'Tagesblüte', zen: 'Zen-Garten',
    restoration: 'Restaurierungsfortschritt', specimens: 'Pflanzensammlung', bestScore: 'Bestwert', streak: 'Aktuelle Serie',
    continueRestoration: 'Restaurierung fortsetzen', playNow: 'Spielen', undo: 'Rückgängig', hint: 'Gartenhinweis',
    restart: 'Neustart', menu: 'Menü', level: 'Level', score: 'Punkte', moves: 'Züge', blooms: 'Blüten',
    leaks: 'Lecks geschlossen', glasshouseRestored: 'Glashaus restauriert', nextLevel: 'Nächstes Level', replay: 'Wiederholen',
    returnMenu: 'Zum Menü', settings: 'Einstellungen', help: 'Spielanleitung', resume: 'Fortsetzen', close: 'Schließen',
    loading: 'Das Glashaus wird geöffnet…', tagline: 'Verbinde das Licht. Erwecke jede Blüte.',
  },
  it: {
    continue: 'Continua', campaign: 'Campagna', daily: 'Fioritura giornaliera', zen: 'Giardino zen',
    restoration: 'Progresso restauro', specimens: 'Collezione botanica', bestScore: 'Miglior punteggio', streak: 'Serie attuale',
    continueRestoration: 'Continua il restauro', playNow: 'Gioca', undo: 'Annulla', hint: 'Suggerimento',
    restart: 'Ricomincia', menu: 'Menu', level: 'Livello', score: 'Punti', moves: 'Mosse', blooms: 'Fiori',
    leaks: 'Perdite sigillate', glasshouseRestored: 'Serra restaurata', nextLevel: 'Livello successivo', replay: 'Rigioca',
    returnMenu: 'Torna al menu', settings: 'Impostazioni', help: 'Come giocare', resume: 'Riprendi', close: 'Chiudi',
    loading: 'Apertura della serra…', tagline: 'Ricollega la luce. Risveglia ogni fiore.',
  },
  ru: {
    continue: 'Продолжить', campaign: 'Кампания', daily: 'Цветок дня', zen: 'Дзен-сад',
    restoration: 'Прогресс восстановления', specimens: 'Коллекция растений', bestScore: 'Лучший результат',
    streak: 'Текущая серия', chamberProgress: 'Прогресс залов', continueRestoration: 'Продолжить восстановление',
    playNow: 'Играть', undo: 'Отменить', hint: 'Подсказка сада', rotateView: 'Повернуть вид', restart: 'Начать заново',
    menu: 'Меню', level: 'Уровень', score: 'Очки', moves: 'Ходы', blooms: 'Цветы', leaks: 'Утечки закрыты',
    glasshouseRestored: 'Оранжерея восстановлена', nextLevel: 'Следующий уровень', replay: 'Повторить',
    returnMenu: 'Вернуться в меню', newSpecimen: 'Открыто новое растение', settings: 'Настройки', help: 'Как играть',
    resume: 'Продолжить', sound: 'Звуковые эффекты', music: 'Фоновая музыка', reducedMotion: 'Меньше анимации',
    highContrast: 'Высокий контраст', quality: 'Качество графики', language: 'Язык', close: 'Закрыть',
    pauseTitle: 'Игра приостановлена', noHint: 'Механизм уже выровнен.',
    adUnavailable: 'Рекламная подсказка сейчас недоступна.', fixed: 'Этот механизм закреплён.',
    undoEmpty: 'Отменять нечего.', hintThinking: 'Садовник отслеживает поток…',
    hintInstruction: 'Поверните элемент: ряд {row}, колонка {column} — {turns}.', once: 'один раз', twice: 'два раза', threeTimes: 'три раза',
    howTitle: 'Восстановите цветочный контур',
    howBody: 'Поворачивайте механизмы, пока энергия не достигнет всех цветов и все активные утечки не будут закрыты.',
    howOne: 'Нажмите на механизм, чтобы повернуть его по часовой стрелке.',
    howTwo: 'Бирюзовые каналы получают энергию от Солнечного источника.',
    howThree: 'Красные значки показывают утечки, а замки — закреплённые детали.',
    mapTitle: 'Карта восстановления', mapBody: 'Соедините все залы и верните оранжерее жизнь.',
    dailyReady: 'Доступна новая головоломка', dayStreak: 'дней подряд', loading: 'Открываем оранжерею…',
    campaignSub: 'Восстанавливайте залы и открывайте редкие цветы.', dailySub: 'Одна ежедневная головоломка для всех игроков.',
    zenSub: 'Бесконечный сад без таймера.', tagline: 'Соедините поток. Разбудите каждый цветок.',
    objectiveLeak: 'Цветы: {blooms} · активных утечек: {leaks}', objectiveClear: 'Все {blooms} цветка получают энергию · утечек нет',
    newRecord: 'Новый рекорд', leaderboardUpdated: 'Результат отправлен', masterwork: 'Идеальный контур', current: 'Текущий', locked: 'Закрыто', complete: 'Пройдено',
  },
};

export class I18n {
  public constructor(public language: SupportedLanguage) {}

  public t(key: TranslationKey, variables: Record<string, string | number> = {}): string {
    let value = translations[this.language][key] ?? en[key];
    for (const [name, replacement] of Object.entries(variables)) {
      value = value.replaceAll(`{${name}}`, String(replacement));
    }
    return value;
  }

  public number(value: number): string {
    return new Intl.NumberFormat(this.language).format(value);
  }

  public time(milliseconds: number): string {
    const total = Math.max(0, Math.round(milliseconds / 1_000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}

export function detectLanguage(): SupportedLanguage {
  const code = navigator.language.toLowerCase().split('-')[0];
  return code === 'es' || code === 'fr' || code === 'de' || code === 'it' || code === 'ru' ? code : 'en';
}
