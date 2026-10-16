// Lecture vocale des messages via la synthèse vocale du navigateur
// (gratuite, locale, sans clé d'API). Elle illustre le fichier audio
// que le DFPlayer Mini lirait depuis la carte mémoire.
export class Speech {
  constructor() {
    this.supported = 'speechSynthesis' in window;
    this.enabled = this.supported;
    this.voice = null;
    if (this.supported) {
      const pick = () => {
        const voices = speechSynthesis.getVoices();
        this.voice = voices.find((v) => v.lang === 'fr-FR') || voices.find((v) => v.lang && v.lang.startsWith('fr')) || null;
      };
      pick();
      speechSynthesis.addEventListener?.('voiceschanged', pick);
    }
  }

  speak(text) {
    if (!this.enabled) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'fr-FR';
      if (this.voice) u.voice = this.voice;
      u.rate = 0.95;
      speechSynthesis.speak(u);
    } catch (e) {
      /* synthèse vocale indisponible : la bulle de texte suffit */
    }
  }

  cancel() {
    if (this.supported) speechSynthesis.cancel();
  }
  pause() {
    if (this.supported) speechSynthesis.pause();
  }
  resume() {
    if (this.supported) speechSynthesis.resume();
  }
}
