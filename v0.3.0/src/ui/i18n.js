const EN = {
    title: 'Clockwork Conservatory', subtitle: 'Bloom Circuit', tagline: 'Restore the flow. Awaken every bloom.',
    continue: 'Continue Restoration', campaign: 'Campaign', campaignDetail: 'Restore the glasshouse', daily: 'Daily Bloom', dailyDetail: 'A new puzzle every day', zen: 'Zen Garden', zenDetail: 'Relax without a timer',
    restoration: 'Restoration Progress', collection: 'Specimen Collection', chamber: 'Orchid Atrium', completed: 'completed',
    howToPlay: 'How to Play', settings: 'Settings', connected: 'Arkadium connected', standalone: 'Preview mode',
    level: 'Level', score: 'Score', moves: 'Moves', blooms: 'Blooms', leaks: 'Leaks', undo: 'Undo', hint: 'Garden Hint', restart: 'Restart', menu: 'Menu', pause: 'Pause',
    tutorial1Title: 'Guide the bloom current', tutorial1Body: 'Rotate the glowing mechanism to carry aetherlight to the sleeping flower.',
    tutorial2Title: 'Feed every branch', tutorial2Body: 'Turn the junction so both flowers receive energy without a leak.',
    tutorial3Title: 'Work around anchors', tutorial3Body: 'Locked mechanisms cannot rotate. Complete the circuit around them.',
    tryIt: 'Try it', fixed: 'This mechanism is anchored.', wrongTutorial: 'Use the highlighted mechanism.',
    hintThinking: 'The Conservator is studying the circuit…', hintInstruction: 'Rotate row {row}, column {column} {turns}.', once: 'once', twice: 'twice', threeTimes: 'three times', noHint: 'The circuit is already aligned.', adUnavailable: 'Rewarded hint is unavailable right now.',
    restored: 'Glasshouse Restored', perfect: 'Perfect Circuit', graceful: 'Graceful Circuit', complete: 'Circuit Restored', nextLevel: 'Next Level', replay: 'Replay', returnMenu: 'Return to Menu', newRecord: 'New record!', specimenUnlocked: 'New specimen unlocked: {name}',
    pauseTitle: 'Conservatory Paused', resume: 'Resume', sound: 'Sound', motion: 'Reduce motion', contrast: 'High contrast', quality: 'Visual quality', tutorialHints: 'Guided tutorial', language: 'Language', auto: 'Auto', high: 'High', balanced: 'Balanced', low: 'Low', close: 'Close',
    helpTitle: 'How to Play', help1: 'Rotate mechanisms to connect the Sunwell to every flower.', help2: 'Every powered pipe must connect cleanly. Open ends create leaks.', help3: 'Earn three stars with efficient moves. Use Garden Hint when you are stuck.',
    loading: 'Warming the Sunwell…', saveRestored: 'Your restoration was recovered.', undoEmpty: 'Nothing to undo.', dailyBest: 'Daily best', leaderboardPosted: 'Score posted to the Daily Bloom leaderboard.', leaderboardOffline: 'Daily score saved locally.',
    lumen: 'Lumen Orchid', orchid: 'Velvet Orchid', starbell: 'Starbell', ember: 'Ember Bloom', moonfern: 'Moon Fern',
};
const DICTS = {
    en: EN,
    es: { ...EN,
        tagline: 'Restaura el flujo. Despierta cada flor.', continue: 'Continuar restauración', campaign: 'Campaña', campaignDetail: 'Restaura el invernadero', daily: 'Floración diaria', dailyDetail: 'Un nuevo puzle cada día', zen: 'Jardín zen', zenDetail: 'Relájate sin cronómetro', restoration: 'Progreso de restauración', collection: 'Colección de especímenes', completed: 'completado', howToPlay: 'Cómo jugar', settings: 'Ajustes', level: 'Nivel', score: 'Puntuación', moves: 'Movimientos', blooms: 'Flores', leaks: 'Fugas', undo: 'Deshacer', hint: 'Pista del jardín', restart: 'Reiniciar', menu: 'Menú', pause: 'Pausa', tryIt: 'Pruébalo', fixed: 'Este mecanismo está anclado.', wrongTutorial: 'Usa el mecanismo resaltado.', restored: 'Invernadero restaurado', perfect: 'Circuito perfecto', graceful: 'Circuito elegante', complete: 'Circuito restaurado', nextLevel: 'Siguiente nivel', replay: 'Repetir', returnMenu: 'Volver al menú', newRecord: '¡Nuevo récord!', pauseTitle: 'Invernadero en pausa', resume: 'Continuar', sound: 'Sonido', motion: 'Reducir movimiento', contrast: 'Alto contraste', quality: 'Calidad visual', tutorialHints: 'Tutorial guiado', language: 'Idioma', close: 'Cerrar', helpTitle: 'Cómo jugar', loading: 'Calentando el Pozo Solar…', undoEmpty: 'Nada que deshacer.', auto: 'Auto', high: 'Alta', balanced: 'Equilibrada', low: 'Baja' },
    fr: { ...EN,
        tagline: 'Rétablissez le flux. Éveillez chaque fleur.', continue: 'Continuer la restauration', campaign: 'Campagne', campaignDetail: 'Restaurez la verrière', daily: 'Floraison du jour', dailyDetail: 'Un nouveau puzzle chaque jour', zen: 'Jardin zen', zenDetail: 'Détendez-vous sans chronomètre', restoration: 'Progression de restauration', collection: 'Collection de spécimens', completed: 'terminé', howToPlay: 'Comment jouer', settings: 'Paramètres', level: 'Niveau', score: 'Score', moves: 'Coups', blooms: 'Fleurs', leaks: 'Fuites', undo: 'Annuler', hint: 'Indice du jardin', restart: 'Recommencer', menu: 'Menu', pause: 'Pause', tryIt: 'Essayez', fixed: 'Ce mécanisme est ancré.', wrongTutorial: 'Utilisez le mécanisme illuminé.', restored: 'Verrière restaurée', perfect: 'Circuit parfait', graceful: 'Circuit élégant', complete: 'Circuit restauré', nextLevel: 'Niveau suivant', replay: 'Rejouer', returnMenu: 'Retour au menu', newRecord: 'Nouveau record !', pauseTitle: 'Verrière en pause', resume: 'Reprendre', sound: 'Son', motion: 'Réduire les animations', contrast: 'Contraste élevé', quality: 'Qualité visuelle', tutorialHints: 'Tutoriel guidé', language: 'Langue', close: 'Fermer', helpTitle: 'Comment jouer', loading: 'Activation du Puits solaire…', undoEmpty: 'Rien à annuler.', auto: 'Auto', high: 'Élevée', balanced: 'Équilibrée', low: 'Faible' },
    de: { ...EN,
        tagline: 'Stelle den Fluss wieder her. Erwecke jede Blüte.', continue: 'Restaurierung fortsetzen', campaign: 'Kampagne', campaignDetail: 'Restauriere das Gewächshaus', daily: 'Tagesblüte', dailyDetail: 'Jeden Tag ein neues Rätsel', zen: 'Zen-Garten', zenDetail: 'Entspanne ohne Zeitdruck', restoration: 'Restaurierungsfortschritt', collection: 'Pflanzensammlung', completed: 'abgeschlossen', howToPlay: 'Spielanleitung', settings: 'Einstellungen', level: 'Level', score: 'Punkte', moves: 'Züge', blooms: 'Blüten', leaks: 'Lecks', undo: 'Rückgängig', hint: 'Gartenhinweis', restart: 'Neustart', menu: 'Menü', pause: 'Pause', tryIt: 'Ausprobieren', fixed: 'Dieser Mechanismus ist verankert.', wrongTutorial: 'Benutze den markierten Mechanismus.', restored: 'Gewächshaus restauriert', perfect: 'Perfekter Kreislauf', graceful: 'Eleganter Kreislauf', complete: 'Kreislauf restauriert', nextLevel: 'Nächstes Level', replay: 'Erneut spielen', returnMenu: 'Zum Menü', newRecord: 'Neuer Rekord!', pauseTitle: 'Gewächshaus pausiert', resume: 'Fortsetzen', sound: 'Ton', motion: 'Bewegung reduzieren', contrast: 'Hoher Kontrast', quality: 'Bildqualität', tutorialHints: 'Geführtes Tutorial', language: 'Sprache', close: 'Schließen', helpTitle: 'Spielanleitung', loading: 'Sonnenbrunnen wird aktiviert…', undoEmpty: 'Nichts rückgängig zu machen.', auto: 'Auto', high: 'Hoch', balanced: 'Ausgewogen', low: 'Niedrig' },
    it: { ...EN,
        tagline: 'Ripristina il flusso. Risveglia ogni fiore.', continue: 'Continua il restauro', campaign: 'Campagna', campaignDetail: 'Restaura la serra', daily: 'Fioritura giornaliera', dailyDetail: 'Un nuovo rompicapo ogni giorno', zen: 'Giardino zen', zenDetail: 'Rilassati senza timer', restoration: 'Progresso del restauro', collection: 'Collezione di esemplari', completed: 'completato', howToPlay: 'Come giocare', settings: 'Impostazioni', level: 'Livello', score: 'Punteggio', moves: 'Mosse', blooms: 'Fiori', leaks: 'Perdite', undo: 'Annulla', hint: 'Suggerimento del giardino', restart: 'Ricomincia', menu: 'Menu', pause: 'Pausa', tryIt: 'Prova', fixed: 'Questo meccanismo è ancorato.', wrongTutorial: 'Usa il meccanismo evidenziato.', restored: 'Serra restaurata', perfect: 'Circuito perfetto', graceful: 'Circuito elegante', complete: 'Circuito restaurato', nextLevel: 'Livello successivo', replay: 'Rigioca', returnMenu: 'Torna al menu', newRecord: 'Nuovo record!', pauseTitle: 'Serra in pausa', resume: 'Riprendi', sound: 'Audio', motion: 'Riduci movimento', contrast: 'Contrasto elevato', quality: 'Qualità visiva', tutorialHints: 'Tutorial guidato', language: 'Lingua', close: 'Chiudi', helpTitle: 'Come giocare', loading: 'Attivazione del Pozzo solare…', undoEmpty: 'Niente da annullare.', auto: 'Auto', high: 'Alta', balanced: 'Bilanciata', low: 'Bassa' },
};
export class I18n {
    constructor(language = detectLanguage()) {
        Object.defineProperty(this, "language", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.language = language;
    }
    t(key, params = {}) {
        let value = DICTS[this.language][key] ?? EN[key];
        for (const [name, replacement] of Object.entries(params))
            value = value.split(`{${name}}`).join(String(replacement));
        return value;
    }
    number(value) { return new Intl.NumberFormat(this.language).format(value); }
    time(milliseconds) {
        const seconds = Math.max(0, Math.round(milliseconds / 1000));
        return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
}
export function detectLanguage() {
    const code = navigator.language.toLowerCase().slice(0, 2);
    return ['en', 'es', 'fr', 'de', 'it'].includes(code) ? code : 'en';
}
export function isLanguage(value) { return ['en', 'es', 'fr', 'de', 'it'].includes(value); }
//# sourceMappingURL=i18n.js.map