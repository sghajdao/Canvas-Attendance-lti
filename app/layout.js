import './globals.css';

export const metadata = {
  title: 'Canvas LTI 1.3 App',
  description: 'LTI 1.3 Application integrated with Canvas LMS',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}