import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText);
const hero = document.querySelector<HTMLElement>(".hero-scroll");
const toggle = hero?.querySelector<HTMLButtonElement>(".motion-toggle");
const preferences = gsap.matchMedia();

if (hero && toggle) {
	preferences.add(
		{
			motion: "(prefers-reduced-motion: no-preference)",
			fine: "(hover: hover) and (pointer: fine)",
			narrow: "(max-width: 760px)",
		},
		(context) => {
			if (!context.conditions?.motion) return;
			const strength = context.conditions.narrow ? 0.65 : 1;
			let paused = false;
			const animations: gsap.core.Animation[] = [];
			const triggers: ScrollTrigger[] = [];
			const cleanup: (() => void)[] = [];
			const q = gsap.utils.selector(hero);
			hero.classList.add("motion-active");
			toggle.hidden = false;
			const cue = hero.querySelector<HTMLElement>(".scroll-cue")!;
			cue.hidden = false;

			const entrance = gsap.timeline({
				defaults: { duration: 1.1, ease: "expo.out" },
			});
			entrance
				.from(
					q(".object-disc .object-intro"),
					{ xPercent: 35, yPercent: -45, rotation: 65, scale: 0.75 },
					0,
				)
				.from(
					q(".object-sleeve .object-intro"),
					{ xPercent: -30, yPercent: 30, rotation: -18 },
					0.06,
				)
				.from(
					q(".object-tape .object-intro"),
					{ scale: 0.45, rotation: -55 },
					0.1,
				)
				.from(
					q(".object-cover-a .object-intro"),
					{ xPercent: -120, rotation: -60, scale: 0.6 },
					0.14,
				)
				.from(
					q(".object-cover-b .object-intro"),
					{ xPercent: 100, rotation: 55, scale: 0.6 },
					0.18,
				);
			animations.push(entrance);

			const story = gsap.timeline({
				defaults: { ease: "power2.inOut" },
				scrollTrigger: {
					trigger: hero,
					start: "top top",
					end: "bottom bottom",
					scrub: 0.65,
					invalidateOnRefresh: true,
				},
			});
			if (story.scrollTrigger) triggers.push(story.scrollTrigger);
			story
				.to(
					q(".pointer-rig"),
					{ scale: 0.66, xPercent: -3, yPercent: 4, duration: 0.36 },
					0,
				)
				.to(
					q(".object-disc"),
					{
						xPercent: 20 * strength,
						yPercent: -30 * strength,
						rotation: 58,
						rotationY: -24 * strength,
						z: 110 * strength,
						duration: 0.32,
					},
					0,
				)
				.to(
					q(".object-sleeve"),
					{
						xPercent: -27 * strength,
						yPercent: 10 * strength,
						rotation: -19,
						rotationY: 18 * strength,
						z: -70 * strength,
						duration: 0.32,
					},
					0,
				)
				.to(
					q(".object-tape"),
					{
						scale: 1.15,
						rotation: -34,
						rotationX: 25 * strength,
						z: 55 * strength,
						duration: 0.38,
					},
					0,
				)
				.to(
					q(".object-cover-a"),
					{
						xPercent: -30 * strength,
						yPercent: -80 * strength,
						rotation: -29,
						rotationY: -30 * strength,
						z: 130 * strength,
						duration: 0.34,
					},
					0.02,
				)
				.to(
					q(".object-cover-b"),
					{
						xPercent: 25 * strength,
						yPercent: 35 * strength,
						rotation: 30,
						rotationY: 30 * strength,
						z: 90 * strength,
						duration: 0.34,
					},
					0.02,
				)
				.fromTo(
					q(".rail-ink"),
					{ strokeDasharray: 1, strokeDashoffset: 1 },
					{ strokeDashoffset: 0, duration: 0.8, ease: "none" },
					0,
				)
				.to(
					q(".scene-label"),
					{ autoAlpha: 1, duration: 0.12, stagger: 0.05 },
					0.18,
				)
				.to(q(".scene-label"), { autoAlpha: 0, duration: 0.1 }, 0.62)
				.to(
					q(".music-object"),
					{
						xPercent: 0,
						yPercent: 0,
						rotation: 0,
						rotationX: 0,
						rotationY: 0,
						z: 0,
						scale: 1,
						duration: 0.35,
					},
					0.65,
				)
				.to(
					q(".pointer-rig"),
					{ scale: 1, xPercent: 0, yPercent: 0, duration: 0.35 },
					0.65,
				);
			animations.push(story);

			const splitters: SplitText[] = [];
			for (const heading of document.querySelectorAll<HTMLElement>(
				"h1, .section-intro h2, .cover-story h2, .safety h2",
			)) {
				const isHero = heading.tagName === "H1";
				splitters.push(
					SplitText.create(heading, {
						type: "words,lines",
						mask: "lines",
						autoSplit: true,
						aria: "auto",
						onSplit(self) {
							const words = gsap.from(self.words, {
								yPercent: 110,
								rotationX: -35,
								transformOrigin: "50% 100%",
								duration: isHero ? 0.85 : 0.7,
								stagger: 0.055,
								ease: "expo.out",
								...(isHero
									? {}
									: {
											scrollTrigger: {
												trigger: heading,
												start: "top 92%",
												toggleActions: "play none none none",
											},
										}),
							});
							animations.push(words);
							if (words.scrollTrigger) triggers.push(words.scrollTrigger);
							return words;
						},
					}),
				);
			}
			const coverTurn = gsap.from(".cover-story figure", {
				rotation: -8,
				scale: 0.86,
				transformOrigin: "50% 60%",
				ease: "none",
				scrollTrigger: {
					trigger: ".cover-story",
					start: "top bottom",
					end: "center center",
					scrub: 0.5,
				},
			});
			animations.push(coverTurn);
			if (coverTurn.scrollTrigger) triggers.push(coverTurn.scrollTrigger);
			const arrowDraw = gsap.fromTo(
				".journey .sequence svg path",
				{ strokeDasharray: 40, strokeDashoffset: 40 },
				{
					strokeDashoffset: 0,
					stagger: 0.1,
					duration: 0.45,
					ease: "power2.out",
					scrollTrigger: { trigger: ".journey", start: "top 85%" },
				},
			);
			animations.push(arrowDraw);
			if (arrowDraw.scrollTrigger) triggers.push(arrowDraw.scrollTrigger);

			if (context.conditions.fine) {
				const stage = hero.querySelector<HTMLElement>(".record-stage")!;
				const rig = q(".pointer-rig");
				const tiltX = gsap.quickTo(rig, "rotationX", {
					duration: 0.7,
					ease: "power3.out",
				});
				const tiltY = gsap.quickTo(rig, "rotationY", {
					duration: 0.7,
					ease: "power3.out",
				});
				animations.push(tiltX.tween, tiltY.tween);
				const move = (event: PointerEvent) => {
					if (paused) return;
					const box = stage.getBoundingClientRect();
					tiltX((0.5 - (event.clientY - box.top) / box.height) * 10);
					tiltY(((event.clientX - box.left) / box.width - 0.5) * 14);
				};
				const leave = () => {
					if (paused) return;
					tiltX(0);
					tiltY(0);
				};
				stage.addEventListener("pointermove", move);
				stage.addEventListener("pointerleave", leave);
				cleanup.push(() => {
					stage.removeEventListener("pointermove", move);
					stage.removeEventListener("pointerleave", leave);
					tiltX.tween.kill();
					tiltY.tween.kill();
				});
				for (const button of document.querySelectorAll<HTMLElement>(
					".hero .button, .cover-story .button",
				)) {
					const x = gsap.quickTo(button, "x", {
						duration: 0.3,
						ease: "power3.out",
					});
					const y = gsap.quickTo(button, "y", {
						duration: 0.3,
						ease: "power3.out",
					});
					animations.push(x.tween, y.tween);
					const moveButton = (event: PointerEvent) => {
						if (paused) return;
						const box = button.getBoundingClientRect();
						x((event.clientX - box.left - box.width / 2) * 0.06);
						y((event.clientY - box.top - box.height / 2) * 0.1);
					};
					const reset = () => {
						if (paused) return;
						x(0);
						y(0);
					};
					button.addEventListener("pointermove", moveButton);
					button.addEventListener("pointerleave", reset);
					cleanup.push(() => {
						button.removeEventListener("pointermove", moveButton);
						button.removeEventListener("pointerleave", reset);
						x.tween.kill();
						y.tween.kill();
					});
				}
			}

			const setPaused = () => {
				paused = !paused;
				document.documentElement.classList.toggle("motion-paused", paused);
				toggle.setAttribute("aria-pressed", String(paused));
				toggle.querySelector("span")!.textContent = paused
					? "Resume motion"
					: "Pause motion";
				if (paused) {
					for (const trigger of triggers) trigger.disable(false);
					for (const animation of animations) animation.progress(1).pause();
					gsap.set(q(".pointer-rig"), { rotationX: 0, rotationY: 0 });
					gsap.set(".hero .button, .cover-story .button", { x: 0, y: 0 });
				} else {
					for (const trigger of triggers) trigger.enable(false);
					ScrollTrigger.refresh();
				}
			};
			toggle.addEventListener("click", setPaused);
			const visibility = () => {
				if (document.hidden) entrance.pause();
				else if (!paused && entrance.progress() < 1) entrance.resume();
			};
			document.addEventListener("visibilitychange", visibility);
			visibility();
			ScrollTrigger.refresh();
			return () => {
				toggle.removeEventListener("click", setPaused);
				document.removeEventListener("visibilitychange", visibility);
				for (const release of cleanup) release();
				for (const split of splitters) split.revert();
				hero.classList.remove("motion-active");
				document.documentElement.classList.remove("motion-paused");
				toggle.hidden = true;
				toggle.setAttribute("aria-pressed", "false");
				toggle.querySelector("span")!.textContent = "Pause motion";
				cue.hidden = true;
			};
		},
	);
}
