import StyledComponentsRegistry from "@/lib/registry";
import { SerwistProvider } from "@/lib/serwist-provider";
import { APP_URL } from "@/utils/constants/api";
import { Metadata, Viewport } from "next";

const appleTouchIconUrl = `${APP_URL}/apple-touch-icon.png`;
const favicon32Url = `${APP_URL}/favicon-32x32.png`;
const favicon16Url = `${APP_URL}/favicon-16x16.png`;

export const metadata: Metadata = {
  title: "iPod.js",
  description: "An iPod Classic built for the web.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "iPod.js",
  },
  icons: [
    {
      rel: "apple-touch-icon",
      sizes: "180x180",
      url: appleTouchIconUrl,
    },
    {
      rel: "icon",
      type: "image/png",
      sizes: "32x32",
      url: favicon32Url,
    },
    {
      rel: "icon",
      type: "image/png",
      sizes: "16x16",
      url: favicon16Url,
    },
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        <SerwistProvider swUrl="/ipod/sw.js" options={{ scope: "/ipod/" }}>
          <StyledComponentsRegistry>{children}</StyledComponentsRegistry>
        </SerwistProvider>
      </body>
    </html>
  );
}
