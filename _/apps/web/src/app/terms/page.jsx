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

export default function TermsOfServicePage() {
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
              Terms of Service
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Last updated: {UPDATED_AT}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700">
          <p>
            These Terms govern your use of nCommon (the "Service"). By using the
            Service, you agree to these Terms.
          </p>
        </div>

        <Section title="Eligibility">
          <p>
            You must be at least{" "}
            <span className="font-semibold">18 years old</span> to use the
            Service. nCommon is not for minors.
          </p>
        </Section>

        <Section title="Your account">
          <ul className="list-disc pl-5">
            <li>You're responsible for the activity on your account.</li>
            <li>
              You agree to provide accurate information and keep it up to date.
            </li>
            <li>
              You may not use the Service to impersonate someone or mislead
              others.
            </li>
          </ul>
        </Section>

        <Section title="Community rules">
          <p>You agree not to:</p>
          <ul className="list-disc pl-5">
            <li>harass, threaten, or bully others</li>
            <li>share illegal content or encourage illegal activity</li>
            <li>attempt to access accounts or data you don't own</li>
            <li>spam, scrape, or misuse the Service</li>
            <li>evade blocks or safety protections</li>
          </ul>
        </Section>

        <Section title="Meeting in person">
          <p>
            nCommon helps you discover people, plans, and events — it does not
            guarantee in-person meetups or outcomes. Use good judgment when
            meeting anyone offline.
          </p>
          <ul className="list-disc pl-5">
            <li>Meet in public places at first.</li>
            <li>Tell a friend where you're going.</li>
            <li>Don't share sensitive info too quickly.</li>
          </ul>
        </Section>

        <Section title="User content">
          <p>
            You may post content like profile text, photos, plans, and messages.
            You retain ownership of your content, but you grant us a license to
            host, store, display, and process it to operate the Service.
          </p>
          <p>
            You're responsible for your content and confirm you have the rights
            to post it.
          </p>
        </Section>

        <Section title="Safety features">
          <p>
            We provide tools like blocks and reports. We may take action (for
            example: remove content, restrict accounts) to keep the Service
            safe.
          </p>
        </Section>

        <Section title="Paid features">
          <p>
            Some features may require payment. Purchases and renewals (if
            applicable) are handled through our payment providers. Refunds,
            cancellations, and access depend on the plan terms shown at purchase
            time and applicable law.
          </p>
        </Section>

        <Section title="Termination">
          <p>
            You may stop using the Service at any time. We may suspend or end
            access if we believe you violated these Terms or if needed to
            protect users and the Service.
          </p>
        </Section>

        <Section title="Disclaimers">
          <p>
            The Service is provided "as is" and "as available". We don't promise
            the Service will be uninterrupted or error-free.
          </p>
        </Section>

        <Section title="Limitation of liability">
          <p>
            To the maximum extent permitted by law, nCommon is not liable for
            indirect, incidental, or consequential damages, or for losses
            arising from your use of the Service.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We may update these Terms from time to time. If changes are
            material, we'll take reasonable steps to notify you.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about these Terms? Contact{" "}
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
            <a className="hover:underline" href="/privacy">
              Privacy Policy
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
