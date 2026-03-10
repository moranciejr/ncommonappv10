import useAuth from "@/utils/useAuth";

const LOGO_URL =
  "https://ucarecdn.com/6d1cb8d8-e9db-44f9-bf57-284e5bf3092c/-/format/auto/";

export default function LogoutPage() {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut({
        callbackUrl: "/",
        redirect: true,
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
        <div className="mb-8 flex flex-col items-center">
          <img
            src={LOGO_URL}
            alt="nCommon"
            className="h-48 w-[720px] max-w-[85vw] object-contain"
          />
          <h1 className="mt-1 text-3xl font-semibold text-[#2D114D]">
            Sign out
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            You can sign back in anytime.
          </p>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full rounded-xl bg-[#4A1D7E] px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-[#3B1763]"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
