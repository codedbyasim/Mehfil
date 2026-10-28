export default function PrivacyPage() {
  return (
    <article className="max-w-3xl space-y-4">
      <p className="text-xs uppercase tracking-[0.22em] text-gold">Privacy</p>
      <h1 className="display text-5xl text-maroon-deep">No account. No kept selfie.</h1>
      <p>
        A photo you upload is sent to the server only so it can be passed to YouCam for that request. The server does not write it to a database. The browser keeps the session, including result images, in IndexedDB on your device until you clear the site data.
      </p>
      <p>
        The groom demo is different: it is a consented portrait of Muhammad Asim, shipped as static files so judges can see a real run without spending units. Bride and guest scenes are drawings, labeled placeholder.
      </p>
      <p>
        MEHFIL does not guess ethnicity, health, or any sensitive trait from a photo. Skin age is YouCam’s score, shown as a score. The hair color name from the tone analyzer is not displayed, because on the live groom run it was wrong.
      </p>
      <p>API keys stay in server environment variables. They are not in the page, the repository, or the logs.</p>
    </article>
  );
}
