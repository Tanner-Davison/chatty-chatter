import { describe, expect, it } from "vitest";
import { acceptImages, imageAt } from "./images";

const file = (name: string, type: string, size = 1000) =>
  new File([new Uint8Array(size)], name, { type });

describe("imageAt", () => {
  it("adds a Cloudinary resize transform", () => {
    expect(imageAt("https://res.cloudinary.com/c/image/upload/v1/chat_images/a.png", 640)).toBe(
      "https://res.cloudinary.com/c/image/upload/c_limit,w_640,q_auto,f_auto/v1/chat_images/a.png",
    );
  });
});

describe("acceptImages", () => {
  it("keeps images and explains what was dropped", () => {
    expect(
      acceptImages([file("a.png", "image/png"), file("b.pdf", "application/pdf")], 0),
    ).toMatchObject({
      accepted: [expect.objectContaining({ name: "a.png" })],
      problem: "Only JPEG, PNG, GIF and WebP images can be sent.",
    });
    expect(acceptImages([file("big.jpg", "image/jpeg", 9 * 1024 * 1024)], 0).problem).toBe(
      "Images can be up to 8 MB.",
    );
    const many = acceptImages(
      Array.from({ length: 3 }, (_, i) => file(`${i}.gif`, "image/gif")),
      2,
    );
    expect(many.accepted).toHaveLength(2);
    expect(many.problem).toBe("Up to 4 photos per message.");
    expect(acceptImages([file("ok.webp", "image/webp")], 0)).toEqual({
      accepted: [expect.anything()],
    });
  });
});
