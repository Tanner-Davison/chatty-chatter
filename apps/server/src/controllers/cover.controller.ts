import type { RequestHandler } from "express";
import { hubCoverFocusSchema, roomNumberParamsSchema } from "@chatty/shared";
import type { ChatImageStore } from "../lib/cloudinary";
import { badRequest } from "../lib/http-error";
import { parse } from "../lib/validate";
import { currentUser } from "../middleware/auth";
import * as roomService from "../services/room.service";

const roomNumberOf = (params: unknown) => parse(roomNumberParamsSchema, params).roomNumber;

/** Hub cover photos, which only the hub's owner can change. */
export function createCoverController(covers: ChatImageStore) {
  const upload: RequestHandler = async (req, res) => {
    const username = currentUser(req).username;
    const roomNumber = roomNumberOf(req.params);
    // Check ownership before anything is sent to Cloudinary.
    await roomService.findOwnedRoom(username, roomNumber);
    if (!req.file) throw badRequest("Attach an image");
    const image = await covers.upload(req.file);
    const { room, replaced } = await roomService.setCover(username, roomNumber, image);
    if (replaced) await covers.remove([replaced.cloudinary_id]);
    res.json(room);
  };

  const reposition: RequestHandler = async (req, res) => {
    const { focus } = parse(hubCoverFocusSchema, req.body);
    res.json(
      await roomService.setCoverFocus(currentUser(req).username, roomNumberOf(req.params), focus),
    );
  };

  const remove: RequestHandler = async (req, res) => {
    const { room, removed } = await roomService.removeCover(
      currentUser(req).username,
      roomNumberOf(req.params),
    );
    if (removed) await covers.remove([removed.cloudinary_id]);
    res.json(room);
  };

  /** Deleting a hub also removes its cover from Cloudinary. */
  const deleteRoom: RequestHandler = async (req, res) => {
    const cover = await roomService.deleteRoom(currentUser(req).username, roomNumberOf(req.params));
    if (cover) await covers.remove([cover.cloudinary_id]);
    res.status(204).end();
  };

  return { upload, reposition, remove, deleteRoom };
}
