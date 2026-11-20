/** Clerk components themed with the AgentVerse tokens (see globals.css). */
export const clerkAppearance = {
  cssLayerName: "clerk",
  variables: {
    colorPrimary: "#3554e0",
    colorPrimaryForeground: "#ffffff",
    colorForeground: "#161a2c",
    colorMutedForeground: "#5d6274",
    colorBackground: "#ffffff",
    colorInput: "#ffffff",
    colorInputForeground: "#161a2c",
    colorBorder: "#d7dae3",
    colorRing: "#3554e0",
    colorDanger: "#d92d20",
    colorSuccess: "#1e9e74",
    colorNeutral: "#161a2c",
    fontFamily: "var(--font-ui), ui-sans-serif, system-ui, sans-serif",
    fontFamilyButtons: "var(--font-ui), ui-sans-serif, system-ui, sans-serif",
    fontSize: "0.9375rem",
    borderRadius: "9px",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none border-0 rounded-none bg-transparent",
    card: "shadow-none border-0 bg-transparent p-0 gap-7",
    // Each step's header carries its instructions ("Verify your email", "Enter your password").
    header: "items-start text-left gap-2",
    headerTitle: "font-display text-[1.875rem] leading-tight font-semibold tracking-[-0.02em] text-ink",
    headerSubtitle: "text-[0.95rem] text-ink/65",
    logoBox: "hidden",
    footer: "bg-none bg-transparent",
    footerAction: "bg-transparent",
    formButtonPrimary: "h-11 text-[0.95rem] font-semibold shadow-none",
    socialButtonsBlockButton: "h-11 border border-[#d7dae3] bg-white shadow-none hover:bg-[#f6f7f9]",
    formFieldInput: "h-11 border border-[#d7dae3] shadow-none",
    dividerLine: "bg-[#d7dae3]",
    otpCodeFieldInput: "border border-[#d7dae3]",
  },
} as const;

/** Copy for the first step of Clerk's forms; later steps keep Clerk's own instructions. */
export const clerkLocalization = {
  signIn: {
    start: { title: "Welcome back", subtitle: "Log in to pick up where your spaces left off." },
  },
  signUp: {
    start: { title: "Create your account", subtitle: "Free to use. Your first space takes under a minute." },
  },
};
