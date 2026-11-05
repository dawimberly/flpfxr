import { test } from "node:test";
import assert from "node:assert/strict";
import { employeeStatus, OWNER_EMPLOYEE_ID, requireApprovedEmployee } from "./employee-policy.server.ts";
import { serveEmployeeAsset } from "./employee-assets.server.ts";
import { emailAndPasswordOptions } from "./auth/email-password.ts";
test("signup is disabled and employee membership is server controlled", () => {
  assert.equal(emailAndPasswordOptions.disableSignUp,true);
  assert.equal(employeeStatus(null),401);
  assert.equal(employeeStatus({id:"self-registered"}),403);
  assert.equal(employeeStatus({id:OWNER_EMPLOYEE_ID}),200);
  assert.equal(employeeStatus({id:"approved"}," approved "),200);
  assert.throws(()=>requireApprovedEmployee({id:"outsider"}),error=>error instanceof Response && error.status===403);
});
test("private assets reject non-employees before reading data and still serve employees", async () => {
  let reads=0;
  for (const [user,status] of [[null,401],[{id:"self-registered"},403],[{id:OWNER_EMPLOYEE_ID},200]] as const) {
    const response=await serveEmployeeAsset(new Request("https://example.test/api/employee-assets/crew.js"),async()=>user?{user}:null,async()=>{reads++;return "export default true"});
    assert.equal(response.status,status);
    assert.match(response.headers.get("cache-control")!,/private, no-store/);
  }
  assert.equal(reads,1);
});
