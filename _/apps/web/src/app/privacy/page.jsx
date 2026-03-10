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

export default function PrivacyPolicyPage() {
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
              Privacy Policy
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Last updated: {UPDATED_AT}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700">
          <p>
            This Privacy Policy explains how nCommon ("we", "us") collects,
            uses, and shares information when you use our app and website.
          </p>
        </div>

        <Section title="Information we collect">
          <p>
            <span className="font-semibold">Account information:</span> email,
            and basic profile info you provide (name, bio, city/state, photos).
          </p>
          <p>
            <span className="font-semibold">Location information:</span> if you
            allow location access, we use your approximate or precise location
            to show nearby people, plans, and events.
          </p>
          <p>
            <span className="font-semibold">Messages and activity:</span> we
            process messages you send, plus actions like stars, blocks, reports,
            and join requests.
          </p>
          <p>
            <span className="font-semibold">Device and usage data:</span> basic
            technical data (like app version and errors) to keep the app working
            and improve reliability.
          </p>
          <p>
            <span className="font-semibold">Payment information:</span> if you
            purchase paid features, payments are processed by our payment
            providers. We receive limited information like purchase status and
            plan details, not your full card number.
          </p>
        </Section>

        <Section title="How we use information">
          <p>We use your information to:</p>
          <ul className="list-disc pl-5">
            <li>create and maintain your account</li>
            <li>show nearby people, plans, and events</li>
            <li>enable messaging and requests</li>
            <li>prevent abuse, spam, and fraud</li>
            <li>improve performance and fix bugs</li>
          </ul>
        </Section>

        <Section title="How we share information">
          <p>
            <span className="font-semibold">With other users:</span> your
            profile info and activity (like plans you create) may be visible to
            other users depending on your settings.
          </p>
          <p>
            <span className="font-semibold">Service providers:</span> we may use
            vendors to help run the app (for example: email delivery, payments,
            hosting). They only get access needed to provide the service.
          </p>
          <p>
            <span className="font-semibold">
              With third-party integrations:
            </span>{" "}
            the Service may rely on third-party APIs (for example: maps/search,
            email delivery, file storage, and payments). These providers process
            data on our behalf to provide their services.
          </p>
          <p>
            <span className="font-semibold">Safety/legal:</span> we may share
            information if required to comply with law, protect users, or
            respond to valid requests.
          </p>
        </Section>

        <Section title="Location and visibility">
          <p>
            If you enable location access, we use it to show nearby people,
            check-ins, plans, and events. You can change location permissions in
            your device settings.
          </p>
          <p>
            Some profile fields may be visible to other users. You can adjust
            certain visibility settings in the app (for example: hide distance,
            appear offline).
          </p>
        </Section>

        <Section title="Data retention">
          <p>
            We keep information as long as needed to provide the service and
            operate the app. If you delete your account, we delete or
            de-identify data where required, and may retain limited records for
            safety, security, and legal compliance.
          </p>
        </Section>

        <Section title="Your rights and choices">
          <ul className="list-disc pl-5">
            <li>Access or update your profile information in the app.</li>
            <li>Request account deletion in Settings.</li>
            <li>Control notifications and visibility settings.</li>
            <li>Disable location sharing using your device settings.</li>
          </ul>
        </Section>

        <Section title="Security">
          <p>
            We use reasonable safeguards designed to protect your information.
            No system is 100% secure, so please use caution when sharing.
          </p>
        </Section>

        <Section title="Children">
          <p>
            nCommon is intended for adults and is{" "}
            <span className="font-semibold">18+</span>. We do not knowingly
            collect personal information from anyone under 18. If you believe a
            minor has provided information, contact us and we'll take
            appropriate steps.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            For privacy questions, contact us at{" "}
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
            <a className="hover:underline" href="/safety">
              Safety Tips
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
