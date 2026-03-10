const LOGO_URL =
  "https://ucarecdn.com/6d1cb8d8-e9db-44f9-bf57-284e5bf3092c/-/format/auto/";

const UPDATED_AT = "February 3, 2026";

function Section({ title, children }) {
  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-[#2D114D]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-gray-700">
        {children}
      </div>
    </div>
  );
}

export default function SafetyTipsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-3xl px-6 pt-0 pb-6">
        <div className="flex flex-col items-center gap-1">
          <img
            src={LOGO_URL}
            alt="nCommon"
            className="h-48 w-[720px] max-w-[85vw] object-contain -mb-6"
          />
          <div className="flex flex-col items-center gap-1">
            <h1 className="text-3xl font-semibold text-[#2D114D] text-center">
              Safety Tips
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Last updated: {UPDATED_AT}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700">
          <p>
            nCommon is an <span className="font-semibold">18+</span> community.
            These tips are here to help you meet and chat safely.
          </p>
        </div>

        <Section title="Before you meet">
          <ul className="list-disc pl-5">
            <li>Meet in public, well-lit places for the first meetup.</li>
            <li>Tell a friend where you're going and when you'll be done.</li>
            <li>Keep the first meetup short (for example: 30–60 minutes).</li>
            <li>Trust your gut — if something feels off, leave.</li>
          </ul>
        </Section>

        <Section title="Location & privacy">
          <ul className="list-disc pl-5">
            <li>Don't share your home address, workplace, or school early.</li>
            <li>
              Keep personal details private until you feel comfortable (full
              name, socials, phone number).
            </li>
            <li>
              Use in-app features (plans, check-ins, chat) rather than sending
              sensitive info.
            </li>
          </ul>
        </Section>

        <Section title="Messaging safety">
          <p>Be careful with anyone who:</p>
          <ul className="list-disc pl-5">
            <li>tries to rush you into meeting right away</li>
            <li>pushes hard to move off-app immediately</li>
            <li>asks for money, gift cards, crypto, or "verification" fees</li>
            <li>pressures you to share private info or photos</li>
          </ul>
          <p>
            Never share passwords, one-time codes, financial info, or anything
            you wouldn't want public.
          </p>
        </Section>

        <Section title="Block & report">
          <ul className="list-disc pl-5">
            <li>
              If someone is harassing you, use{" "}
              <span className="font-semibold">Block</span>.
            </li>
            <li>
              If someone is threatening, scamming, or unsafe, use{" "}
              <span className="font-semibold">Report</span>.
            </li>
          </ul>
          <p>If you feel in danger, contact your local emergency number.</p>
        </Section>

        <Section title="18+ only">
          <p>
            nCommon is for adults only. We do not allow minors. If you believe a
            user may be under 18, please report them.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Safety questions? Contact{" "}
            <a
              className="font-medium text-[#4A1D7E] hover:underline"
              href="mailto:support@ncommon.app"
            >
              support@ncommon.app
            </a>
            .
          </p>
        </Section>

        <div className="mt-10 border-t border-gray-200 pt-6 text-xs text-gray-500">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <a className="hover:underline" href="/terms">
              Terms of Service
            </a>
            <a className="hover:underline" href="/privacy">
              Privacy Policy
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
