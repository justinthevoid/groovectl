import { mount } from "svelte";
import Gallery from "./Gallery.svelte";
import "./kit.css";
const target = document.getElementById("gallery");
if (!target) throw new Error("Missing gallery root.");
mount(Gallery, { target });
