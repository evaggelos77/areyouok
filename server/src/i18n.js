const strings = {
  el: {
    appName: 'AreYouOK',
    checkinTitle: 'Είσαι καλά;',
    checkinBody: 'Απάντησε για να ξέρουν τα Άτομα Εμπιστοσύνης ότι είσαι ασφαλής.',
    checkinReminderTitle: 'Υπενθύμιση: Είσαι καλά;',
    checkinReminderBody: 'Πάτησε ΟΚ ή ζήτα βοήθεια.',
    circleNoResponseTitle: 'Δεν απάντησε στο check-in',
    circleNoResponseBody: ({ name }) => `${name ?? 'Κάποιος'} δεν απάντησε μέσα σε 3′.`,
    okSignalTitle: ({ name }) => `${name ?? 'Κάποιος'} είναι OK`,
    okSignalBody: 'Έστειλε σήμα ότι είναι ασφαλής.',
    callMeSignalTitle: ({ name }) => `${name ?? 'Κάποιος'} ζητάει να τον/την πάρεις`,
    callMeSignalBody: 'Πάρε τον/την τώρα αν μπορείς.',
    needHelpSignalTitle: ({ name }) => `🆘 ${name ?? 'Κάποιος'} χρειάζεται βοήθεια`,
    needHelpSignalBody: 'Δες λεπτομέρειες & επικοινώνησε άμεσα.',
    voiceHelpSignalTitle: ({ name }) => `🎙️ ${name ?? 'Κάποιος'} ενεργοποίησε φωνητική βοήθεια`,
    voiceHelpSignalBody: 'Ακούστηκε λέξη-κλειδί. Άνοιξε το app και επικοινώνησε άμεσα.',
    pickMeUpSignalTitle: ({ name }) => `${name ?? 'Κάποιος'}: Έλα να με πάρεις`,
    pickMeUpSignalBody: 'Ζήτησε μεταφορά από τα Άτομα Εμπιστοσύνης.',

    sosSignalTitle: ({ name }) => `🆘 SOS: ${name ?? 'Κάποιος'}`,
    sosSignalBodyWithLocation: 'SOS ενεργό. Δες τοποθεσία μέσα στο app.',
    sosSignalBodyNoLocation: 'SOS ενεργό. Άνοιξε το app.',

    notifOkAction: '✅ ΟΚ',
    notifCallMeAction: '☎️ Πάρε με',
    notifHelpAction: '🆘 Βοήθεια'
  },
  en: {
    appName: 'AreYouOK',
    checkinTitle: 'Are you ok?',
    checkinBody: 'Reply so your Trusted People know you’re safe.',
    checkinReminderTitle: 'Reminder: Are you ok?',
    checkinReminderBody: 'Tap OK or ask for help.',
    circleNoResponseTitle: 'No response to check-in',
    circleNoResponseBody: ({ name }) => `${name ?? 'Someone'} didn’t respond in 3 minutes.`,
    okSignalTitle: ({ name }) => `${name ?? 'Someone'} is OK`,
    okSignalBody: 'Sent a safety signal.',
    callMeSignalTitle: ({ name }) => `${name ?? 'Someone'} wants you to call`,
    callMeSignalBody: 'Call them if you can.',
    needHelpSignalTitle: ({ name }) => `🆘 ${name ?? 'Someone'} needs help`,
    needHelpSignalBody: 'Open the app and reach out now.',
    voiceHelpSignalTitle: ({ name }) => `🎙️ ${name ?? 'Someone'} triggered voice help`,
    voiceHelpSignalBody: 'A keyword was detected. Open the app and reach out now.',
    pickMeUpSignalTitle: ({ name }) => `${name ?? 'Someone'}: Come pick me up`,
    pickMeUpSignalBody: 'Requested a pickup from Trusted People.',

    sosSignalTitle: ({ name }) => `🆘 SOS: ${name ?? 'Someone'}`,
    sosSignalBodyWithLocation: 'SOS active. View location in the app.',
    sosSignalBodyNoLocation: 'SOS active. Open the app.',

    notifOkAction: '✅ OK',
    notifCallMeAction: '☎️ Call me',
    notifHelpAction: '🆘 Help'
  }
};

function t(lang, key, params) {
  const l = strings[lang] ? lang : 'en';
  const value = strings[l][key];
  if (typeof value === 'function') return value(params || {});
  return value ?? key;
}

module.exports = { t, strings };
