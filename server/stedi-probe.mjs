import { config } from 'dotenv';
config({ quiet: true });
const key = process.env.STEDI_API_KEY;
const URL = 'https://healthcare.us.stedi.com/2024-04-01/change/medicalnetwork/eligibility/v3';

async function attempt(label, body) {
  const res = await fetch(URL, { method: 'POST', headers: { Authorization: key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  const aaa = [...(j.subscriber?.aaaErrors ?? []), ...(j.errors ?? [])].map(e => `${e.code}:${e.description}`).join('; ');
  const status = j.planStatus?.map(p => `${p.statusCode}=${p.status}`).join(',');
  const benefits = j.benefitsInformation?.length ?? 0;
  console.log(`${label.padEnd(28)} HTTP ${res.status}  planStatus=[${status ?? ''}]  benefits=${benefits}  ${aaa ? 'AAA ' + aaa.slice(0,90) : ''}`);
  return j;
}

const base = { provider: { organizationName: 'SurgeryReady Clinic', npi: '1999999984' }, encounter: { serviceTypeCodes: ['30'] } };

await attempt('aetna no-dob',     { ...base, tradingPartnerServiceId: '60054', subscriber: { firstName: 'Jane', lastName: 'Doe', memberId: 'AETNA12345' } });
await attempt('cigna no-dob',     { ...base, tradingPartnerServiceId: '62308', subscriber: { firstName: 'Jane', lastName: 'Doe', memberId: 'CIGNA12345' } });
await attempt('uhc no-dob',       { ...base, tradingPartnerServiceId: '87726', subscriber: { firstName: 'Jane', lastName: 'Doe', memberId: 'UHC12345' } });
