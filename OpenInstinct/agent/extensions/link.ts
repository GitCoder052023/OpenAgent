import link from "@stripe/link-integrations-eve";
import { linkAuth } from "@agent/lib/link-auth";

export default link({ auth: linkAuth });
