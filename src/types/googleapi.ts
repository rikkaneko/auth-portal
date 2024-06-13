// From https://github.com/googleapis/google-api-nodejs-client/blob/main/src/apis/oauth2/v2.ts:227
export interface OAuth2Client$Userinfo {
  email?: string | null;
  family_name?: string | null;
  gender?: string | null;
  given_name?: string | null;
  hd?: string | null;
  id?: string | null;
  link?: string | null;
  locale?: string | null;
  name?: string | null;
  picture?: string | null;
  verified_email?: boolean | null;
}
