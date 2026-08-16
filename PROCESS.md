# Process overview

<!-- TEMPLATE: this file is a shape to fill in, not a form. Replace everything
     in it with your own overview, and delete this comment — `pnpm
     check:evidence` will remind you if it's still here. -->

A reading-guide to how the work came together --- a map to your process, not an
essay about it. Markers read this file and follow its citations; they don't
trawl the repo for evidence you didn't point at, so if a moment mattered, cite
it.

This file is the shape; the course site's
[assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#what-you-submit)
is the requirement, and each brief adds its own word count and moment count.

## What I built

One paragraph: the thing, and the idea behind it.

This site aims to explain the theory of special relativity by letting the visitor experience its effects. It follows an interactive story-like structure, around two twins who are sepeated, where one boards a rocket and one stays on Earth. The site user gets to control the rocket's speed and observe time dilate, with different rates of aging and visual changes to show the characters gap widen. Upon moving to the reunion stage, the side by side reveal shows the difference in aging, with the following section explaining why it occurs, with a real-world example to solidify the concept. The site has deliberately been made in a way that it is accessible a vast range of ages to understand this concept. An optional msuic player links to the Interstellar sounds tracks on YouTube for the atmosphere.

## The moments that mattered

Three or four for an assignment; fewer is fine for a weekly prototype. Keep the
list short so each moment has room to do all four jobs:

1. **what happened** --- the problem, or the thing the agent got wrong
2. **what you did instead of the obvious thing** --- the call you made, and why
   it beat the obvious one
3. **how you knew it was right** --- the check you ran, the viewport you looked
   at, what you read before accepting the diff
4. **the citation** --- a commit or commit range, a `CLAUDE.md` change, a check
   that went from red to green, a prompt paired with the commit it produced

Jobs 2 and 3 are the ones the repo can't tell a reader on its own, so they're
where the marks are. The strongest moments are the ones where a correction
landed in the **harness** rather than in another prompt --- a rule added to
`CLAUDE.md`, a check wired up, an attempt thrown away: re-prompting until it
passes is the routine case, and changing what the agent works against is the
skilled one.

Cite each moment as a link whose text is the commit hash or range and whose
target is this repo's commit or compare URL, so a reader clicks straight to the
evidence:

- one commit: [`a1b2c3d`](https://github.com/YOUR-ORG/YOUR-REPO/commit/a1b2c3d)
- a range:
  [`a1b2c3d...e4f5a6b`](https://github.com/YOUR-ORG/YOUR-REPO/compare/a1b2c3d...e4f5a6b)

To pair a prompt with the commit it produced, quote the prompt (curated, not a
full transcript) next to the citation:

> the prompt, verbatim

Screenshots are welcome where one carries the verification better than a
sentence does. Commit the file to this repo and link it with a **relative**
path, which is what makes it render on GitHub: `![alt text](docs/before.png)`.
Images don't count towards the word count and don't replace the citation.

I started by creating and writing `PLAN.md`, as a shell of the project - the story and deliverables, not the fine and complex detail. I did this so I would have something to reference lightly (if I need to mention some part of the site, without deep detail) or work deeply when focusing on a specific deliverable, as it suits my how I like to approach problems. As `CLAUDE.md` loads into every session,  I split the two: universal constraints and tests stayed in `CLAUDE.md`, project shell and step-by-step deliverables stayed in `PLAN.MD`, so I wasn't burning context re-reading deliverable detail on turns that didn't need it (examples of this can be seen in the starting commits of: b8de38f, 82aea9c - note, `CLAUDE.md` and `PLAN.md` were updated throughout the project too). A drawback of this approach I realized later into the project occurred when: originally I was going for multiple scenes in the animation, but then later, I changed this to a single flight of the rocket, and needed to remember to update `PLAN.md` to reflect this (96cf7da). Though I still opted to keep this structure, it was an important event in making me realize the tradeoffs that come with decisions - the maintenance cost - even when I got Claude to update the file to reflect the changes we discussed, I still needed to remember to update it, and then review it, to ensure the project was going the direction I still wanted.

When manually testing the site, I found a bug that, after going through the full narrative once, after restarting the story, the twin-separation/rocket animation would drop out. I had found encountered animation related issues during the development process too earlier, and found myself burning tokens making Claude aware of this. Having to find these bugs manually, I decided to add a test into the harness, giving me assurance that such errors would be caught, and less time, and tokens, would be burnt when resolving such issues. I began by mapping out the space that would trigger the bugs, experimenting with the site, to narrow down how/why the bugs were caused. Upon finding that it only occurred after a full initial run, I notified Claude about the issue, so it could reason and find the underlying issue, and then form a test for it, so if work on the animation and related areas was done, a deterministic test could check it behaved as expected (commit ___).


With code generation being cheap and quick to implement, I knew I had the ability to implement ideas, and scrap them quickly, with minimal cost. During the animation sequence, I got Claude to critique my ideas, and we discussed the textures to use on the planets and the sun. Giving me the option of pixel-art, or using real imagery. I needed to decide which to use. Instead of going through the entire process, and then deciding to switch later down the line, taking up additional time and budget, I asked Claude to generate me what both would look like side by side (without animations, just static renders to keep it cheap on tokens). Claude returned a HTML file, to help me visualize better (as seen below). The throw away file was cheap and I was able clearly visualize the choices of decisions Claude was prompting me to pick between. This significantly gave me more confidence in what the output would look like and thus, and thus, more sure of my decision.

### A worked moment, for shape

Delete this section along with the rest of the boilerplate --- it's here to show
the four jobs in one paragraph, not to be imitated in content.

> The date formatter kept coming back with `toLocaleDateString()` and no locale
> argument, so the same build rendered differently on my machine and in CI. I'd
> already re-prompted it twice, which fixed the line but not the habit, so the
> third time I put the rule in `CLAUDE.md` instead
> ([`3f9ac21`](https://github.com/YOUR-ORG/YOUR-REPO/commit/3f9ac21)) and added
> a spec test that fails on a bare `toLocaleDateString`. That's what told me it
> had actually taken: the test went red against the old code and green against
> the new, and the next two features it wrote passed it without prompting
> ([`3f9ac21...b7e0d14`](https://github.com/YOUR-ORG/YOUR-REPO/compare/3f9ac21...b7e0d14)).

## Before you ship

`pnpm check:evidence` verifies your citations resolve to real commits, that the
current reflection entry is in `reflections/`, and that your `CLAUDE.md` is
there --- before a marker ever opens the file. It checks that your map is
traceable, not that it is good: the marker judges whether your small,
deliberately chosen set of moments shows real judgement and reflection. A green
check is not a substitute for that curation.

Images are deliberately not checked, because whether one renders is visible the
moment you look. Open this file on GitHub and look at it before you ship.
