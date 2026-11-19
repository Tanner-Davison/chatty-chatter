import type { RequestHandler } from "express";
import {
  alertSettingsSchema,
  pushEndpointSchema,
  pushSubscriptionSchema,
  unsubscribeSchema,
  type PushConfig,
} from "@chatty/shared";
import type { Env } from "../config/env";
import type { Pusher } from "../lib/push";
import { parse } from "../lib/validate";
import { currentUser } from "../middleware/auth";
import * as alertService from "../services/alert.service";

export function createAlertController(env: Env, pusher: Pusher) {
  const pushConfig: RequestHandler = (_req, res) => {
    res.json({ publicKey: pusher.publicKey } satisfies PushConfig);
  };

  const subscribe: RequestHandler = async (req, res) => {
    const sub = parse(pushSubscriptionSchema, req.body);
    await alertService.addPushSubscription(currentUser(req).username, sub);
    res.status(204).end();
  };

  const unsubscribePush: RequestHandler = async (req, res) => {
    const { endpoint } = parse(pushEndpointSchema, req.body);
    await alertService.removePushSubscription(currentUser(req).username, endpoint);
    res.status(204).end();
  };

  const updateSettings: RequestHandler = async (req, res) => {
    const { emailAlerts } = parse(alertSettingsSchema, req.body);
    res.json(await alertService.setEmailAlerts(currentUser(req).username, emailAlerts));
  };

  /**
   * From the email's link (token in the body) or the mail app's one-click
   * unsubscribe (token in the query, form-encoded body).
   */
  const unsubscribeEmail: RequestHandler = async (req, res) => {
    const { token } = parse(unsubscribeSchema, { token: req.query.token ?? req.body?.token });
    await alertService.unsubscribe(env, token);
    res.status(204).end();
  };

  return { pushConfig, subscribe, unsubscribePush, updateSettings, unsubscribeEmail };
}
