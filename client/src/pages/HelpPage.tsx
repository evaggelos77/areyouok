import React, { useMemo, useState } from 'react';
import { Phone } from 'lucide-react';
import TopBar from '../components/TopBar';
import { usePrefs } from '../contexts/PrefsContext';

// Verified May 2026 against official sources: moh.gov.gr, isotita.gr, hamogelo.gr,
// ekka.org.gr, mila.gov.gr. All support lines below are nationwide, 24/7 and free.
const EMERGENCY_LINES = [
  { num: '112', el: 'Ευρωπαϊκός αριθμός έκτακτης ανάγκης', en: 'European emergency number' },
  { num: '100', el: 'Αστυνομία', en: 'Police' },
  { num: '166', el: 'ΕΚΑΒ — Ασθενοφόρο', en: 'Ambulance (EKAB)' },
  { num: '199', el: 'Πυροσβεστική', en: 'Fire brigade' }
];

const SUPPORT_LINES = [
  {
    num: '15900',
    el: 'Βία κατά των γυναικών / ενδοοικογενειακή βία · 24ωρο, δωρεάν',
    en: 'Violence against women / domestic violence · 24/7, free'
  },
  {
    num: '1056',
    el: 'SOS για παιδιά — Το Χαμόγελο του Παιδιού · 24ωρο, δωρεάν',
    en: 'Children SOS — The Smile of the Child · 24/7, free'
  },
  {
    num: '116111',
    el: 'Στήριξη παιδιών & εφήβων — Το Χαμόγελο του Παιδιού · 24ωρο, δωρεάν',
    en: 'Children & teens support — The Smile of the Child · 24/7, free'
  },
  {
    num: '197',
    el: 'Άμεση κοινωνική βοήθεια — ΕΚΚΑ · 24ωρο, δωρεάν',
    en: 'Emergency social support — EKKA · 24/7, free'
  },
  {
    num: '10306',
    el: 'Ψυχοκοινωνική υποστήριξη (κάθε ηλικία) · δωρεάν',
    en: 'Psychosocial support (any age) · free'
  }
];

type GuideSectionId =
  | 'what'
  | 'install'
  | 'orb'
  | 'sos'
  | 'safewalk'
  | 'trusted'
  | 'voice_sos'
  | 'bullying'
  | 'checkin'
  | 'settings'
  | 'privacy';

type GuideSection = {
  id: GuideSectionId;
  title: string;
  icon: string;
  content: React.ReactNode;
};

export default function HelpPage() {
  const prefs = usePrefs();
  const [open, setOpen] = useState<GuideSectionId | null>('what');

  const isEl = prefs.lang === 'el';

  const sections: GuideSection[] = useMemo(
    () => [
      {
        id: 'what',
        icon: '🛡️',
        title: isEl ? 'Τι είναι το AreYouOK' : 'What is AreYouOK',
        content: isEl ? (
          <>
            <p className="help-p">Το AreYouOK είναι ένα ψηφιακό εργαλείο κηδεμόνα και προσωπικής ασφάλειας.</p>

            <p className="help-p">Φτιάχτηκε για να βοηθά:</p>
            <ul className="help-ul">
              <li>παιδιά και εφήβους,</li>
              <li>γονείς και κηδεμόνες,</li>
              <li>ανθρώπους μεγαλύτερης ηλικίας,</li>
              <li>να μπορούν εύκολα να πουν “είμαι καλά” ή να ζητήσουν βοήθεια, όταν χρειάζεται.</li>
            </ul>

            <p className="help-p">Δεν είναι εφαρμογή παρακολούθησης.</p>
            <p className="help-p">Στέλνει σήμα μόνο όταν το ζητήσεις εσύ ή όταν υπάρχει πραγματική ανάγκη.</p>
          </>
        ) : (
          <>
            <p className="help-p">AreYouOK is a digital guardian and personal-safety tool.</p>

            <p className="help-p">It was built to help:</p>
            <ul className="help-ul">
              <li>children and teens,</li>
              <li>parents and guardians,</li>
              <li>older people,</li>
              <li>easily say “I’m OK”, or ask for help when needed.</li>
            </ul>

            <p className="help-p">It is not a tracking app.</p>
            <p className="help-p">It only sends a signal when you ask it to, or when there is a real need.</p>
          </>
        )
      },
      {
        id: 'install',
        icon: '📲',
        title: isEl ? 'Πώς το εγκαθιστάς' : 'How to install it',
        content: isEl ? (
          <>
            <div className="help-callout">Σε 10 δευτερόλεπτα το AreYouOK γίνεται εφαρμογή — χωρίς App Store.</div>

            <p className="help-p">Το ανοίγεις πιο γρήγορα, σαν κανονικό app, στο κινητό ή στον υπολογιστή σου.</p>

            <ul className="help-ul help-steps">
              <li>
                <strong>iPhone (Safari):</strong> Κοινοποίηση → Προσθήκη στην Αρχική Οθόνη
              </li>
              <li>
                <strong>Android (Chrome):</strong> «Εγκατάσταση εφαρμογής» / «Προσθήκη στην Αρχική»
              </li>
              <li>
                <strong>Υπολογιστής (Chrome/Edge):</strong> Εικονίδιο εγκατάστασης στη γραμμή διεύθυνσης ή Μενού → Εγκατάσταση
              </li>
            </ul>
          </>
        ) : (
          <>
            <div className="help-callout">In 10 seconds AreYouOK becomes an app — no App Store.</div>

            <p className="help-p">You open it faster, like a real app, on your phone or computer.</p>

            <ul className="help-ul help-steps">
              <li>
                <strong>iPhone (Safari):</strong> Share → Add to Home Screen
              </li>
              <li>
                <strong>Android (Chrome):</strong> “Install app” / “Add to Home screen”
              </li>
              <li>
                <strong>Computer (Chrome/Edge):</strong> Install icon in the address bar, or Menu → Install
              </li>
            </ul>
          </>
        )
      },
      {
        id: 'orb',
        icon: '✅',
        title: isEl ? 'Ο μεγάλος κύκλος “ΕΙΜΑΙ ΟΚ”' : 'The big “I’M OK” circle',
        content: isEl ? (
          <>
            <p className="help-p">Στο κέντρο της αρχικής οθόνης υπάρχει ο κύκλος “ΕΙΜΑΙ ΟΚ”.</p>

            <p className="help-p">Με ένα πάτημα:</p>
            <ul className="help-ul">
              <li>ανοίγουν οι Γρήγορες ενέργειες, ώστε να κάνεις αυτό που χρειάζεσαι σε δευτερόλεπτα.</li>
            </ul>

            <p className="help-p">Οι γρήγορες ενέργειες σε βοηθούν να:</p>
            <ul className="help-ul">
              <li>δηλώσεις “είμαι καλά”,</li>
              <li>ζητήσεις να σε πάρουν τηλέφωνο,</li>
              <li>δηλώσεις “δεν είμαι καλά”,</li>
              <li>μοιραστείς την τοποθεσία σου για λίγα λεπτά (αν το επιλέξεις).</li>
            </ul>
          </>
        ) : (
          <>
            <p className="help-p">In the center of the home screen there is the “I’M OK” circle.</p>

            <p className="help-p">With one tap:</p>
            <ul className="help-ul">
              <li>Quick actions open, so you can do what you need in seconds.</li>
            </ul>

            <p className="help-p">Quick actions help you:</p>
            <ul className="help-ul">
              <li>mark “I’m OK”,</li>
              <li>ask someone to call you,</li>
              <li>say “I’m not OK”,</li>
              <li>share your location for a few minutes (if you choose).</li>
            </ul>
          </>
        )
      },
      {
        id: 'sos',
        icon: '🚨',
        title: isEl ? 'SOS – Άμεση ανάγκη' : 'SOS – Immediate need',
        content: isEl ? (
          <>
            <p className="help-p">Το SOS είναι για στιγμές που υπάρχει κίνδυνος ή φόβος.</p>

            <p className="help-p">Με το SOS μπορείς:</p>
            <ul className="help-ul">
              <li>να καλέσεις γρήγορα αριθμούς έκτακτης ανάγκης,</li>
              <li>και (αν το έχεις επιτρέψει) να σταλεί ειδοποίηση στους ανθρώπους σου.</li>
            </ul>

            <p className="help-p">Χρησιμοποίησέ το όταν πραγματικά το χρειάζεσαι.</p>
          </>
        ) : (
          <>
            <p className="help-p">SOS is for moments of danger or fear.</p>

            <p className="help-p">With SOS you can:</p>
            <ul className="help-ul">
              <li>quickly call emergency numbers,</li>
              <li>and (if you’ve allowed it) send an alert to your people.</li>
            </ul>

            <p className="help-p">Use it when you really need it.</p>
          </>
        )
      },
      {
        id: 'safewalk',
        icon: '🚶‍♂️',
        title: isEl ? 'SafeWalk – “Είμαι στον δρόμο”' : 'SafeWalk – “I’m on my way”',
        content: isEl ? (
          <>
            <p className="help-p">Το SafeWalk είναι σαν να λες:</p>
            <p className="help-p">“Είμαι έξω και θέλω να έχω μια προστασία.”</p>

            <p className="help-p">Δουλεύει έτσι:</p>
            <ul className="help-ul">
              <li>διαλέγεις διάρκεια,</li>
              <li>διαλέγεις κάθε πόσα λεπτά να σε ρωτάει αν είσαι καλά,</li>
              <li>αν δεν απαντήσεις, ειδοποιεί τα άτομα εμπιστοσύνης.</li>
            </ul>

            <p className="help-p">Ιδανικό για:</p>
            <ul className="help-ul">
              <li>επιστροφή στο σπίτι,</li>
              <li>διαδρομή προς/από σχολείο,</li>
              <li>βραδινές ώρες,</li>
              <li>οποιαδήποτε στιγμή νιώθεις ανασφάλεια.</li>
            </ul>
          </>
        ) : (
          <>
            <p className="help-p">SafeWalk is like saying:</p>
            <p className="help-p">“I’m out and I want some protection.”</p>

            <p className="help-p">It works like this:</p>
            <ul className="help-ul">
              <li>you pick a duration,</li>
              <li>you pick how often it asks if you’re OK,</li>
              <li>if you don’t answer, it alerts your trusted people.</li>
            </ul>

            <p className="help-p">Ideal for:</p>
            <ul className="help-ul">
              <li>heading home,</li>
              <li>the way to/from school,</li>
              <li>evening hours,</li>
              <li>any time you feel unsafe.</li>
            </ul>
          </>
        )
      },
      {
        id: 'trusted',
        icon: '👥',
        title: isEl ? 'Άτομα Εμπιστοσύνης' : 'Trusted People',
        content: isEl ? (
          <>
            <p className="help-p">Εδώ βάζεις τους ανθρώπους που εμπιστεύεσαι.</p>

            <p className="help-p">Μπορεί να είναι:</p>
            <ul className="help-ul">
              <li>γονείς / κηδεμόνες,</li>
              <li>σύντροφος,</li>
              <li>φίλος,</li>
              <li>κάποιο κοντινό σου πρόσωπο.</li>
            </ul>

            <p className="help-p">Αυτά τα άτομα μπορούν να ειδοποιηθούν σε περιπτώσεις όπως:</p>
            <ul className="help-ul">
              <li>SOS,</li>
              <li>SafeWalk,</li>
              <li>όταν δεν υπάρξει απάντηση,</li>
              <li>Bullying SOS.</li>
            </ul>
          </>
        ) : (
          <>
            <p className="help-p">Here you add the people you trust.</p>

            <p className="help-p">They can be:</p>
            <ul className="help-ul">
              <li>parents / guardians,</li>
              <li>a partner,</li>
              <li>a friend,</li>
              <li>someone close to you.</li>
            </ul>

            <p className="help-p">These people can be notified in cases like:</p>
            <ul className="help-ul">
              <li>SOS,</li>
              <li>SafeWalk,</li>
              <li>when there is no response,</li>
              <li>Bullying SOS.</li>
            </ul>
          </>
        )
      },
      {
        id: 'voice_sos',
        icon: '🎤',
        title: isEl ? 'Οπλισμός Φωνητικού SOS' : 'Voice SOS arming',
        content: isEl ? (
          <>
            <p className="help-p">Αυτό σε βοηθά όταν δεν μπορείς να πατήσεις κουμπί.</p>

            <p className="help-p">Όταν το ενεργοποιείς:</p>
            <ul className="help-ul">
              <li>το τηλέφωνο “ακούει” λέξεις-κλειδιά που έχεις ορίσει,</li>
              <li>αν πεις τη λέξη-κλειδί, στέλνει αυτόματα SOS.</li>
            </ul>

            <p className="help-p">Χρήσιμο όταν:</p>
            <ul className="help-ul">
              <li>είσαι σε πίεση,</li>
              <li>τα χέρια σου δεν είναι ελεύθερα,</li>
              <li>δεν μπορείς να κοιτάξεις την οθόνη.</li>
            </ul>

            <p className="help-p">Μπορείς να το κλείσεις όποτε θέλεις.</p>
          </>
        ) : (
          <>
            <p className="help-p">This helps when you can’t press a button.</p>

            <p className="help-p">When you enable it:</p>
            <ul className="help-ul">
              <li>the phone “listens” for keywords you’ve set,</li>
              <li>if you say the keyword, it automatically sends SOS.</li>
            </ul>

            <p className="help-p">Useful when:</p>
            <ul className="help-ul">
              <li>you’re under pressure,</li>
              <li>your hands aren’t free,</li>
              <li>you can’t look at the screen.</li>
            </ul>

            <p className="help-p">You can turn it off whenever you want.</p>
          </>
        )
      },
      {
        id: 'bullying',
        icon: '🛑',
        title: isEl ? 'Bullying SOS – Διακριτική βοήθεια' : 'Bullying SOS – Discreet help',
        content: isEl ? (
          <>
            <p className="help-p">Το Bullying SOS υπάρχει για περιπτώσεις εκφοβισμού (bullying).</p>

            <p className="help-p">Με ένα πάτημα:</p>
            <ul className="help-ul">
              <li>ενημερώνει άμεσα τους ανθρώπους εμπιστοσύνης,</li>
              <li>ξεκινά ηχογράφηση ώστε να υπάρχει καταγραφή του περιστατικού,</li>
              <li>και, αν έχει δοθεί άδεια κάμερας, μπορεί να καταγραφεί και σύντομο βίντεο.</li>
            </ul>

            <p className="help-p">Σκοπός του είναι η προστασία και η άμεση βοήθεια.</p>
          </>
        ) : (
          <>
            <p className="help-p">Bullying SOS is for cases of bullying.</p>

            <p className="help-p">With one tap:</p>
            <ul className="help-ul">
              <li>it immediately notifies your trusted people,</li>
              <li>it starts recording so there’s a record of the incident,</li>
              <li>and, if camera access is granted, it can also capture a short video.</li>
            </ul>

            <p className="help-p">Its purpose is protection and immediate help.</p>
          </>
        )
      },
      {
        id: 'checkin',
        icon: '💬✅',
        title: isEl ? 'Check-in – “Στέλνω ένα σήμα ότι είμαι καλά”' : 'Check-in – “I send a signal that I’m OK”',
        content: isEl ? (
          <>
            <p className="help-p">Το Check-in είναι ένα απλό μήνυμα ενημέρωσης:</p>
            <p className="help-p">“Είμαι καλά.”</p>

            <p className="help-p">Μπορεί να σταλεί:</p>
            <ul className="help-ul">
              <li>χειροκίνητα,</li>
              <li>ή με πρόγραμμα (όπου υπάρχει διαθέσιμο).</li>
            </ul>

            <p className="help-p">Είναι χρήσιμο για γονείς που θέλουν μια γρήγορη επιβεβαίωση μέσα στη μέρα.</p>
          </>
        ) : (
          <>
            <p className="help-p">Check-in is a simple status message:</p>
            <p className="help-p">“I’m OK.”</p>

            <p className="help-p">It can be sent:</p>
            <ul className="help-ul">
              <li>manually,</li>
              <li>or on a schedule (where available).</li>
            </ul>

            <p className="help-p">It’s useful for parents who want a quick confirmation during the day.</p>
          </>
        )
      },
      {
        id: 'settings',
        icon: '⚙️',
        title: isEl ? 'Ρυθμίσεις' : 'Settings',
        content: isEl ? (
          <>
            <p className="help-p">Στις Ρυθμίσεις μπορείς να:</p>
            <ul className="help-ul">
              <li>αλλάξεις εμφάνιση,</li>
              <li>ενεργοποιήσεις/απενεργοποιήσεις ειδοποιήσεις,</li>
              <li>ρυθμίσεις απορρήτου,</li>
              <li>ορίσεις φράσεις-κλειδιά για το Φωνητικό SOS,</li>
              <li>βάλεις όρια (anti-spam) για να μη γίνονται υπερβολικά πολλά check-in.</li>
            </ul>
          </>
        ) : (
          <>
            <p className="help-p">In Settings you can:</p>
            <ul className="help-ul">
              <li>change the appearance,</li>
              <li>turn notifications on/off,</li>
              <li>adjust privacy settings,</li>
              <li>set keywords for Voice SOS,</li>
              <li>set limits (anti-spam) so there aren’t too many check-ins.</li>
            </ul>
          </>
        )
      },
      {
        id: 'privacy',
        icon: '🔒',
        title: isEl ? 'Απόρρητο – με απλά λόγια' : 'Privacy – in plain words',
        content: isEl ? (
          <>
            <p className="help-p">Η τοποθεσία σου δεν στέλνεται συνέχεια.</p>

            <p className="help-p">Στέλνεται μόνο όταν:</p>
            <ul className="help-ul">
              <li>πατήσεις SOS,</li>
              <li>ενεργοποιήσεις SafeWalk,</li>
              <li>ζητήσεις εσύ να τη μοιραστείς,</li>
              <li>ή σε περίπτωση που δεν υπάρξει απάντηση σε σημαντικό check-in.</li>
            </ul>

            <p className="help-p">Το AreYouOK είναι εργαλείο ασφάλειας, όχι παρακολούθησης.</p>
          </>
        ) : (
          <>
            <p className="help-p">Your location is not sent all the time.</p>

            <p className="help-p">It is sent only when:</p>
            <ul className="help-ul">
              <li>you press SOS,</li>
              <li>you start SafeWalk,</li>
              <li>you ask to share it,</li>
              <li>or there is no response to an important check-in.</li>
            </ul>

            <p className="help-p">AreYouOK is a safety tool, not a tracking tool.</p>
          </>
        )
      }
    ],
    [isEl]
  );

  return (
    <div className="page">
      <TopBar />
      <div className="content safe-pad" style={{ paddingTop: 10 }}>
        <div className="page-title">{prefs.lang === 'el' ? 'Οδηγίες χρήσης' : 'User guide'}</div>

        {/* Crisis helplines — most safety-critical content, always visible (never hidden in an accordion). */}
        <div className="glass neon-outline card" style={{ marginTop: 14 }}>
          <div className="muted" style={{ fontSize: 16 }}>
            {prefs.lang === 'el' ? '📞 Γραμμές βοήθειας' : '📞 Helplines'}
          </div>
          <div className="muted small" style={{ marginTop: 6 }}>
            {prefs.lang === 'el'
              ? 'Πάτησε για κλήση. Σε άμεσο κίνδυνο, κάλεσε 112.'
              : 'Tap to call. In immediate danger, call 112.'}
          </div>

          <div className="muted small" style={{ marginTop: 14, fontWeight: 700 }}>
            {prefs.lang === 'el' ? 'Άμεση ανάγκη' : 'Emergency'}
          </div>
          <div className="sos-list" style={{ marginTop: 8 }}>
            {EMERGENCY_LINES.map((l) => (
              <a key={l.num} className="sos-item" href={`tel:${l.num}`} style={{ textDecoration: 'none' }}>
                <div className="sos-num">
                  <Phone size={18} /> {l.num}
                </div>
                <div className="muted small">{prefs.lang === 'el' ? l.el : l.en}</div>
              </a>
            ))}
          </div>

          <div className="muted small" style={{ marginTop: 16, fontWeight: 700 }}>
            {prefs.lang === 'el' ? 'Γραμμές στήριξης (24ωρο, δωρεάν)' : 'Support lines (24/7, free)'}
          </div>
          <div className="sos-list" style={{ marginTop: 8, gridTemplateColumns: '1fr' }}>
            {SUPPORT_LINES.map((l) => (
              <a key={l.num} className="sos-item" href={`tel:${l.num}`} style={{ textDecoration: 'none' }}>
                <div className="sos-num">
                  <Phone size={18} /> {l.num}
                </div>
                <div className="muted small">{prefs.lang === 'el' ? l.el : l.en}</div>
              </a>
            ))}
          </div>
        </div>

        <div className="glass neon-outline card" style={{ marginTop: 14 }}>
          <div className="muted" style={{ fontSize: 16 }}>
            {prefs.lang === 'el' ? '📘 Οδηγίες Χρήσης (Απλά & Ανθρώπινα)' : '📘 User guide (simple & human)'}
          </div>

          <div className="help-acc" style={{ marginTop: 12 }}>
            {sections.map((s) => {
              const isOpen = open === s.id;
              return (
                <div key={s.id} className={isOpen ? 'help-acc-item open' : 'help-acc-item'}>
                  <button
                    className={isOpen ? 'help-item active help-acc-btn' : 'help-item help-acc-btn'}
                    onClick={() => setOpen(isOpen ? null : s.id)}
                    aria-expanded={isOpen}
                  >
                    <span className="help-acc-left">
                      <span className="help-acc-ic" aria-hidden="true">
                        {s.icon}
                      </span>
                      <span>{s.title}</span>
                    </span>
                    <span className="help-acc-caret" aria-hidden="true">
                      {isOpen ? '▴' : '▾'}
                    </span>
                  </button>

                  {isOpen ? <div className="help-acc-body">{s.content}</div> : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
