**Title: *Time is Trippy - Visual Interactive Story for Understanding the Theory of Relativity***

**Idea:** Want to explain Einstien's theory of relativity

#### **Story structure**
1. Start with black, space background, minimal movement, twinkling stars, a start button
2. **Intro** — Meet the twins. Brief setup: "What if one of you could travel near the speed of light?"
3. **Choice point** — The visitor confirms the path:
	- **Speed (special relativity)** → rocket launch, Three.js zoom-out through the solar system, then split-screen with velocity slider
		- *Update:* built as one continuous flight, not a "zoom-out" cut into a separate shot — liftoff (Sun visible) and the solar-system flyby (Mercury through Saturn, plus an asteroid belt) share a single unbroken camera path and trajectory, no scene cuts or direction changes.
4. **Split screen** — Earth twin on left, travelling twin on right. Clocks tick at different rates. Characters age visibly. The visitor controls the variable (speed).
5. **Reunion** — Twins side by side, age gap revealed. One sentence: "Time bent."
6. **Try new values** — button to go back to the comparison screen and pick a different speed.

#### **The Math**
- **Special relativity (speed path):** Lorentz factor γ = 1/√(1 - v²/c²). Time dilation: t_earth = γ × t_ship. At v=0, γ=1 (no dilation). At v=0.99c, γ≈7.09. At v=0.9999c, γ≈70.7.
- This formula drives the clock tick rates and the ageing visuals. The visitor never sees the equation — they see the effect.
- **Verify the math:** if the slider is at 0.99c, the Earth clock should tick ~7× faster than the ship clock. Spot-check these ratios.

#### **Stack**
- **Astro** (static site generator)
- **Three.js** for the 3D launch/space scene
- **Vanilla JS + CSS** for the split-screen interaction, sliders, clock animations
- Deployed to **GitHub Pages** — static, client-side only

#### **Ageing visuals**
Show ageing through simple, visible changes: hair colour (dark → grey → white), posture, wrinkles as line overlays. Don't aim for photorealism — stylised characters with clear age progression. The difference between the twins at reunion should be immediately obvious without reading any numbers.

#### **Background music**
- Small fixed-position music button in the bottom corner (e.g. a headphones or music note icon). Dark, matches the space theme, unobtrusive.
	- interstellar music, hans zimmer
- Default state: collapsed/closed. Visitor clicks to expand.
- Expanded state: reveals a compact YouTube iframe embed playing the Interstellar soundtrack. Use embed parameters to keep it minimal: have it default set to a loop
- A close/minimize button to collapse it back to the icon.
- This is atmosphere, not a feature. It should not compete with the main interaction for attention or screen space.
- The iframe streams from YouTube — we do not host any audio files.
- On mobile: the button should sit above any other fixed UI and not overlap interactive elements.

