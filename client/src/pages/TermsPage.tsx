import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrefs } from '../contexts/PrefsContext';
import { t } from '../lib/i18n';

type Section = { h: string; body: string[]; warn?: boolean };

const CONTENT: Record<'el' | 'en', { intro: string; sections: Section[] }> = {
  el: {
    intro:
      'Καλώς ήρθες στο AreYouOK — εφαρμογή προσωπικής ασφάλειας της EV LABS AI. Χρησιμοποιώντας την εφαρμογή, αποδέχεσαι τους παρακάτω Όρους Χρήσης και την Πολιτική Απορρήτου.',
    sections: [
      {
        h: '1. Η υπηρεσία',
        body: [
          'Το AreYouOK σου επιτρέπει να στέλνεις σήματα ασφάλειας (SOS, SafeWalk, check-in, ειδοποιήσεις) στα «Άτομα Εμπιστοσύνης» που εσύ ορίζεις, και να μοιράζεσαι την τοποθεσία σου όταν το επιλέξεις.'
        ]
      },
      {
        h: '2. Δεν αντικαθιστά τις υπηρεσίες έκτακτης ανάγκης',
        warn: true,
        body: [
          'Το AreYouOK ΔΕΝ είναι υπηρεσία άμεσης επέμβασης. Σε πραγματικό κίνδυνο κάλεσε ΑΜΕΣΩΣ το 112 (Ευρωπαϊκός Αριθμός Έκτακτης Ανάγκης) ή τις αρμόδιες αρχές.',
          'Η αποστολή ειδοποιήσεων εξαρτάται από το δίκτυο, τη συσκευή και τρίτες υπηρεσίες, και δεν είναι εγγυημένη.'
        ]
      },
      {
        h: '3. Λογαριασμός & σύνδεση',
        body: [
          'Η σύνδεση γίνεται με email και κωδικό μιας χρήσης (OTP). Είσαι υπεύθυνος/η για την ασφάλεια του email σου και της πρόσβασής σου στον λογαριασμό.'
        ]
      },
      {
        h: '4. Συνδρομές & πληρωμές',
        body: [
          'Διατίθενται συνδρομές: Μηνιαία €3,99 και Ετήσια €29. Οι πληρωμές γίνονται με ασφάλεια μέσω Stripe — δεν αποθηκεύουμε στοιχεία κάρτας.',
          'Οι συνδρομές ανανεώνονται αυτόματα έως την ακύρωση. Μπορείς να ακυρώσεις οποτεδήποτε· η πρόσβαση συνεχίζεται έως το τέλος της πληρωμένης περιόδου.'
        ]
      },
      {
        h: '5. Αποδεκτή χρήση',
        body: [
          'Χρησιμοποίησε την εφαρμογή νόμιμα και για τη δική σου ασφάλεια ή με τη συναίνεση των ατόμων που αφορά. Απαγορεύονται η κακόβουλη χρήση, η παρενόχληση και οι ψευδείς συναγερμοί.'
        ]
      },
      {
        h: '6. Δεδομένα & Ιδιωτικότητα',
        body: [
          'Συλλέγουμε μόνο ό,τι χρειάζεται: το email σου (για σύνδεση), τα Άτομα Εμπιστοσύνης που προσθέτεις, και την τοποθεσία σου ΜΟΝΟ όταν στέλνεις SOS/SafeWalk ή τη μοιράζεσαι ρητά. Δεν υπάρχει συνεχής παρακολούθηση.',
          'Δεν πουλάμε τα δεδομένα σου. Έχεις δικαίωμα πρόσβασης, διόρθωσης και διαγραφής (GDPR): γράψε στο info@evlabsai.gr. Τα δεδομένα διατηρούνται όσο διατηρείς λογαριασμό.'
        ]
      },
      {
        h: '7. Περιορισμός ευθύνης',
        body: [
          'Η εφαρμογή παρέχεται «ως έχει». Στον μέγιστο βαθμό που επιτρέπει ο νόμος, η EV LABS AI δεν φέρει ευθύνη για μη παράδοση ή καθυστέρηση ειδοποιήσεων, ή για ζημίες που οφείλονται σε δίκτυο, συσκευές ή τρίτες υπηρεσίες.'
        ]
      },
      {
        h: '8. Αλλαγές στους όρους',
        body: [
          'Ενδέχεται να επικαιροποιήσουμε τους παρόντες όρους. Η συνέχιση χρήσης μετά από αλλαγές συνιστά αποδοχή τους.'
        ]
      },
      {
        h: '9. Εφαρμοστέο δίκαιο',
        body: ['Οι παρόντες όροι διέπονται από το ελληνικό δίκαιο.']
      },
      {
        h: '10. Επικοινωνία',
        body: ['EV LABS AI · info@evlabsai.gr · 210 6856027 · 210 6859383 · Σπάρτης 22, Χαλάνδρι.']
      }
    ]
  },
  en: {
    intro:
      'Welcome to AreYouOK — a personal-safety app by EV LABS AI. By using the app, you accept the Terms of Service and Privacy Policy below.',
    sections: [
      {
        h: '1. The service',
        body: [
          'AreYouOK lets you send safety signals (SOS, SafeWalk, check-ins, alerts) to the Trusted People you choose, and share your location when you decide to.'
        ]
      },
      {
        h: '2. Not a replacement for emergency services',
        warn: true,
        body: [
          'AreYouOK is NOT an emergency response service. In real danger, call 112 (the European emergency number) or your local authorities IMMEDIATELY.',
          'Delivery of alerts depends on networks, devices and third-party services, and is not guaranteed.'
        ]
      },
      {
        h: '3. Account & sign-in',
        body: [
          'Sign-in uses email and a one-time code (OTP). You are responsible for the security of your email and your account access.'
        ]
      },
      {
        h: '4. Subscriptions & payments',
        body: [
          'Subscriptions are available: Monthly €3.99 and Yearly €29. Payments are processed securely by Stripe — we do not store card details.',
          'Subscriptions renew automatically until cancelled. You can cancel anytime; access continues until the end of the paid period.'
        ]
      },
      {
        h: '5. Acceptable use',
        body: [
          'Use the app lawfully and for your own safety, or with the consent of the people involved. Malicious use, harassment and false alarms are prohibited.'
        ]
      },
      {
        h: '6. Data & Privacy',
        body: [
          'We collect only what is needed: your email (sign-in), the Trusted People you add, and your location ONLY when you send SOS/SafeWalk or explicitly share it. There is no continuous tracking.',
          'We do not sell your data. You have the right to access, correct and delete your data (GDPR): email info@evlabsai.gr. Data is kept while your account exists.'
        ]
      },
      {
        h: '7. Limitation of liability',
        body: [
          'The app is provided "as is". To the maximum extent permitted by law, EV LABS AI is not liable for non-delivery or delay of alerts, or for damages caused by networks, devices or third-party services.'
        ]
      },
      {
        h: '8. Changes to these terms',
        body: ['We may update these terms. Continued use after changes constitutes acceptance.']
      },
      {
        h: '9. Governing law',
        body: ['These terms are governed by Greek law.']
      },
      {
        h: '10. Contact',
        body: ['EV LABS AI · info@evlabsai.gr · 210 6856027 · 210 6859383 · Spartis 22, Chalandri, Greece.']
      }
    ]
  }
};

export default function TermsPage() {
  const navigate = useNavigate();
  const { lang } = usePrefs();
  const c = CONTENT[lang] || CONTENT.el;

  return (
    <div className="page safe-pad safe-top">
      <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'left' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ width: 'auto' }}>
          {t(lang, 'termsBack')}
        </button>

        <div className="login-card glass" style={{ marginTop: 16, textAlign: 'left' }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>{t(lang, 'termsTitle')}</h1>
          <div className="muted small" style={{ marginTop: 4 }}>
            {t(lang, 'termsUpdated')}
          </div>
          <p className="muted" style={{ marginTop: 12 }}>
            {c.intro}
          </p>

          {c.sections.map((s, i) => (
            <div
              key={i}
              style={
                s.warn
                  ? {
                      border: '1px solid #f59e0b',
                      borderRadius: 12,
                      padding: 12,
                      margin: '14px 0',
                      background: 'rgba(245,158,11,0.10)'
                    }
                  : { marginTop: 16 }
              }
            >
              <h3 style={{ margin: '0 0 6px', fontSize: 16, color: s.warn ? '#f59e0b' : undefined }}>
                {s.warn ? '⚠️ ' : ''}
                {s.h}
              </h3>
              {s.body.map((p, j) => (
                <p key={j} className="muted" style={{ margin: '6px 0', lineHeight: 1.5 }}>
                  {p}
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
