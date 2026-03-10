export default function BillingSuccessPage() {
  return (
    <div className="min-h-screen bg-[#F6F7FB] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <h1 className="text-[22px] font-bold text-[#101828]">You’re all set</h1>
        <p className="mt-2 text-[14px] text-[#667085]">
          Your upgrade is processing. You can return to the app now.
        </p>
        <p className="mt-4 text-[12px] text-[#98A2B3]">
          If you don’t see your plan update immediately, give it a minute and
          reopen the Upgrade screen.
        </p>
      </div>
    </div>
  );
}
