import { z } from 'zod'

export const mediaSourceSchema = z.union([
  z.object({ url: z.string().url() }),
  z.object({ base64: z.string().min(1) })
])
export type MediaSource = z.infer<typeof mediaSourceSchema>

const recipient = z.string().min(1).max(128)

export const textContentSchema = z.object({
  type: z.literal('text'),
  text: z.string().min(1)
})

export const imageContentSchema = z.object({
  type: z.literal('image'),
  media: mediaSourceSchema,
  caption: z.string().optional()
})

export const videoContentSchema = z.object({
  type: z.literal('video'),
  media: mediaSourceSchema,
  caption: z.string().optional()
})

export const audioContentSchema = z.object({
  type: z.literal('audio'),
  media: mediaSourceSchema,
  voice: z.boolean().optional()
})

export const documentContentSchema = z.object({
  type: z.literal('document'),
  media: mediaSourceSchema,
  filename: z.string().optional(),
  mimetype: z.string().optional(),
  caption: z.string().optional()
})

export const stickerContentSchema = z.object({
  type: z.literal('sticker'),
  media: mediaSourceSchema
})

export const locationContentSchema = z.object({
  type: z.literal('location'),
  latitude: z.number(),
  longitude: z.number(),
  name: z.string().optional(),
  address: z.string().optional()
})

export const contactContentSchema = z.object({
  type: z.literal('contact'),
  fullName: z.string().min(1),
  phone: z.string().min(1)
})

export const messageContentSchema = z.discriminatedUnion('type', [
  textContentSchema,
  imageContentSchema,
  videoContentSchema,
  audioContentSchema,
  documentContentSchema,
  stickerContentSchema,
  locationContentSchema,
  contactContentSchema
])
export type MessageContent = z.infer<typeof messageContentSchema>

export const sendMessageInputSchema = z.object({
  to: recipient,
  content: messageContentSchema
})
export type SendMessageInput = z.infer<typeof sendMessageInputSchema>

export const sendMessageResultSchema = z.object({
  id: z.string().optional()
})
export type SendMessageResult = z.infer<typeof sendMessageResultSchema>
