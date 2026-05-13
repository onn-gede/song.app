import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Biblioteca de cântări",
  description: "Cântări, programe și playlisturi pentru întâlnirile bisericii"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <head>
        <script
          id="disable-react-devtools-hook"
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  if (typeof window === "undefined") return;
                  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
                    isDisabled: true,
                    supportsFiber: true,
                    inject: function () { return -1; },
                    onCommitFiberRoot: function () {},
                    onCommitFiberUnmount: function () {}
                  };
                } catch (error) {}
              })();
            `
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
