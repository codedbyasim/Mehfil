# MEHFIL

A wedding-week look planner for Mehndi, Baraat, and Walima. One consented portrait, three outfits, grooming that belongs with each one, and an event-day skin goal that does not oversell itself.

## Inspiration

South Asian weddings are a week, not an evening. The clothes change, the hour changes, and the makeup has to survive all of it. People still buy those outfits from a flat product photo, often from another city, and the makeup trial happens later, on a different face in a different room. India’s wedding industry is about $130 billion, with 8–10 million weddings a year and a multi-day calendar, according to a Jefferies estimate reported by Business of Fashion. The money is spent before anyone has seen the clothes and the face together.

Round one of this hackathon already had plenty of generic stylists and skin-tone shoppers. Almost nobody anchored the try-on to a specific week of functions, or put apparel and makeup in one image on purpose. That is the gap MEHFIL is for. The builder knows the week firsthand. The demo face is his own, used with consent, because the groom path is the one a judge can trust on sight.

## What it does

You open a groom week and immediately see the same person in a mustard kurta, an ivory-and-gold sherwani, and a navy prince coat. A before/after slider sits on each card. Baraat can flip between “makeup first” and “outfit first,” because both were run for real and they do not look the same.

Behind that, Skin Analysis (standard, seven concerns) and the Facial Color Tones analyzer have already spoken. On this face the overall score is 89, the skin age score is 29, and dark circles at a display score of 63 are the only number that asks for anything. The skin hex is `#805E46`. The hair color name is hidden, because the analyzer called black hair Auburn.

An on-screen stylist reads those numbers, picks a chain, and writes the grooming:

- A groom, or a guest dressing as a man, gets one shared grooming look, then each outfit. That is the cheaper chain, and it is the right one when the makeup does not change.
- A bride, or a guest dressing as a woman, gets makeup after each outfit, a different recipe per function. The live test kept more real skin texture that way.

If a lip color clashes with the garment, the stylist corrects it once and stops. The shade list is generic on purpose: a sheer skin-matched veil, an under-eye softener, a rose tint. No logos.

The skin goal is a Skin Simulation of the face crop. The slider is zoomed to the eyes, because the real render is subtle and pretending otherwise would be a lie. A countdown from today to Mehndi is cosmetic prep only: sleep, a cool compress, do not start a new product this week.

Bride and guest weeks are in the product so the role switch is real. They are drawings, stamped PLACEHOLDER, until someone consents to a live run.

## How we built it

Next.js (App Router, TypeScript) on one Vercel project. Every YouCam and model call is a route handler. The key never reaches the client.

The browser checks type, size, light, and a single face before any paid call, then crops the face to about 60% of the width. Skin analysis, color tones, and simulation use that crop. Clothes try-on uses the full portrait. Without the crop, those skin calls return `error_face_position_too_small`. We learned that by spending a failed tone call, which cost zero units, and then succeeding on the crop.

The async shape is the one in the current docs and in a working Python client we ported: create a file, PUT the bytes to the presigned URL, create a task, poll. The browser polls. Each serverless invocation does one thing and returns, because a job takes 10–20 seconds and a hobby function should not sit on the phone. The next task receives the previous result only after we upload those bytes as a new file. PNG bytes are sniffed even when the URL says `.jpg`.

Clothes VTO v4 is called with `upper_body` for this chest-up portrait. The category list we actually send is `full_body | lower_body | upper_body | shoes | auto | outer`. A full-length photo is asked to use `full_body` for a lehenga or a full sherwani.

The stylist is deterministic first. Scores, hex values, and the hues and ITA° computed from those hex values are the only numbers it may write down. A test fails the build if a sentence cites anything else, or if it uses diagnostic language. An optional AIML call (`gpt-4o-mini`) may rewrite live copy and is thrown away when it invents a figure. Demo mode never calls it.

Demo is the default and costs zero units. Live mode is capped at two runs per IP per day and a daily ceiling (150 by default), then the page falls back to the demo. Analysis is cached by image hash. Tests do not call YouCam.

## Challenges

Chaining clothes and makeup was the risk we were warned about, so we ran both orders on the Baraat sherwani instead of guessing. Outfit-then-makeup kept stubble, a mole, and skin texture. Makeup-then-clothes is a little smoother and lighter, because the clothes model touches the face again, and it is the one to use when a single grooming look is reused. The product lets the planner pick, and the Baraat card shows the other order on demand.

The face-size rule is easy to miss. A portrait that looks perfect to a person is too small for skin analysis. Auto-crop is not a flourish. It is the difference between a 20-unit success and a wasted round trip.

Skin simulation field names are not the analysis names, and the oiliness scale adds shine at the top of the range. The shipped preview uses the exact intensities from the live call and says the change is subtle. The fresh planner leaves oiliness unset.

The tone analyzer’s hair name was confidently wrong. We stopped showing it.

Units are scarce. The whole live groom session, including the failed crop and both Baraat orders, cost 46 units. The public demo costs none, because the renders are already in the repo.

## Accomplishments

- Five YouCam APIs in one flow, with a real VTO-on-VTO result a person can scrub.
- A planner that chooses the chain for a reason, checks color, and replans only once.
- A groom demo that is not a mock: overall 89, dark circles 63, skin `#805E46`, three outfits, both orders, and the eye-level simulation.
- Bride and guest paths that are honestly marked, not fake photographs of strangers.
- A unit guard, a citation test, and a claim test, so the copy cannot drift into medicine or invented scores.
- A look book you can print or download, and a shade list with nothing to license.

## What we learned

Judging in the previous round leaned on the video and the write-up, so the running app had to be legible in a still: one face, three functions, a slider, a number with a source. The interesting engineering was not “call more APIs.” It was refusing to call them until the photo would survive, refusing to show a hair color we knew was wrong, and refusing to animate a skin result that is, honestly, a small change under the eyes.

We also learned the cheaper chain and the more faithful chain are not the same chain. Shipping both, and letting the role decide, is the product.

## What's next

- A consented bride run, with a full-length frame for a lehenga (`full_body`) and a chest-up frame for the blouse.
- A boutique embed: one product image in, the shopper’s portrait, the week out, labeled as a preview and not a fit guarantee.
- Replace the in-memory unit ledger with Upstash when more than one server is warm.
- Record the two-and-a-half minute demo. The script is in `docs/DEMO_SCRIPT.md`.

## Judging map

- **Technical.** File upload, presigned PUT, task create, client polling, content-type sniffing, face crop, two VTO orders, effect JSON that matches the makeup schema, simulation field mapping, unit reservation.
- **Design.** A full week you can walk without an account: photo, dates, outfits, stylist trace, carousel, skin goal, shades, look book. The groom frames are real.
- **Impact.** A named week, a named buyer, a sourced market, and a preview that says what it is not.
- **Idea.** The outfit is given. The week is the product. Apparel and makeup are one image, and the skin goal is allowed to be subtle.
