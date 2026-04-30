import { AppHeader, AppPanel, AppScreen } from "@/components/AppUi";

const sections = [
  {
    title: "מה האפליקציה עושה",
    body: "האפליקציה מאפשרת ליצור רשימות קניות משותפות, להצטרף לרשימות באמצעות קוד, להוסיף מוצרים, לעדכן כמויות ולסמן מוצרים שנקנו.",
  },
  {
    title: "אחריות המשתמשים",
    body: "כל משתמש אחראי לתוכן שהוא מוסיף לרשימות. אין להעלות מידע רגיש, פרטי תשלום, סיסמאות או כל מידע שלא מתאים לשיתוף עם חברי הרשימה.",
  },
  {
    title: "ניהול רשימות וחברים",
    body: "מנהל רשימה יכול לאשר בקשות הצטרפות, להסיר חברים ולמחוק רשימות. חברי רשימה יכולים לעדכן מוצרים ולצאת מרשימות שבהן הם חברים.",
  },
  {
    title: "זמינות השירות",
    body: "האפליקציה ניתנת כפי שהיא. ייתכנו תקלות, עיכובים או הפסקות זמניות בשירות, במיוחד בגלל תלות בשירותים חיצוניים כמו Supabase ו-Vercel.",
  },
  {
    title: "פרטיות ומידע שנשמר",
    body: "האפליקציה שומרת פרטים הנדרשים להפעלה: כתובת מייל, שם תצוגה, רשימות, מוצרים, כמויות, סטטוס קניה וחברות ברשימות.",
  },
  {
    title: "מחיקה ועזיבה",
    body: "ניתן לעזוב רשימה, למחוק רשימה שאתה מנהל, או להסיר חברים מרשימה שאתה מנהל. מחיקת רשימה או מוצרים עשויה למחוק מידע לצמיתות.",
  },
];

export default function TermsPage() {
  return (
    <AppScreen>
      <AppHeader
        title="תנאי שימוש ופרטיות"
        subtitle="רשימת קניות"
        backHref="/login"
      />

      <AppPanel className="space-y-5">
        <div>
          <p className="text-sm font-bold text-[#3880ff]">עודכן לאחרונה</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            שימוש הוגן וברור באפליקציה
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            תנאים אלה נועדו להסביר בקצרה איך משתמשים באפליקציה ואיזה מידע
            נשמר כדי להפעיל אותה. הם אינם מהווים ייעוץ משפטי.
          </p>
        </div>

        <div className="space-y-3">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
            >
              <h3 className="text-base font-black text-slate-950">
                {section.title}
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {section.body}
              </p>
            </section>
          ))}
        </div>

        <p className="rounded-2xl bg-blue-50 p-4 text-sm font-semibold leading-6 text-slate-700">
          בהרשמה לאפליקציה ובהמשך השימוש בה, המשתמש מאשר שקרא והבין את תנאי
          השימוש ומדיניות הפרטיות הקצרה הזו.
        </p>
      </AppPanel>
    </AppScreen>
  );
}
