import urllib.request,http.cookiejar,re,json,base64
from pathlib import Path
base='http://127.0.0.1:3081'
url=re.search(r'http://127\.0\.0\.1:3081/\?token=[A-Za-z0-9._~-]+',Path('dsh-local.log').read_text()).group()
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
client.open(url).read()
def call(method,payload=None):
 req=urllib.request.Request(base+'/api/meb-workbench',data=json.dumps({'endpoint':'meb/'+method,'payload':payload}).encode(),headers={'Content-Type':'application/json'})
 return json.load(client.open(req))
a=call('read')['value']
b=json.loads(json.dumps(a));b['revision']-=1
assert not call('save',b)['ok'],'stale edit accepted'
b=json.loads(json.dumps(a)); b['projects'][0]['rows'].append({'id':'invalid-test','cells':{'reported':'abc'},'files':[],'notes':''})
assert not call('save',b)['ok'],'invalid number accepted'
b=json.loads(json.dumps(a));p=next(p for p in b['projects'] if p['name']=='功能验收 · 示例项目')
f={'id':'meb-test-attachment','projectId':p['id'],'name':'attachment-test.txt','mime':'text/plain','size':39,'data':'data:text/plain;base64,'+base64.b64encode(b'MEB attachment test. No project data.\n').decode(),'createdAt':'2026-09-21T13:22:00Z'}
if not any(x['id']==f['id'] for x in b['files']):b['files'].append(f)
if f['id'] not in p['rows'][0]['files']:p['rows'][0]['files'].append(f['id'])
saved=call('save',b);assert saved['ok'],saved
read=call('read')['value'];assert read==saved['value'];assert next(f for f in read['files'] if f['id']=='meb-test-attachment')['data']==f['data']
Path('test-fixtures/roundtrip-backup.json').write_text(json.dumps(read,ensure_ascii=False,indent=2))
print('PASS: authenticated host save/read, stale revision rejected, invalid quantity rejected, attachment bytes roundtrip, backup serialization.')
try:
 urllib.request.urlopen(urllib.request.Request(base+'/api/meb-workbench',data=b'{}',headers={'Content-Type':'application/json'}))
 raise AssertionError('unauthenticated request accepted')
except urllib.error.HTTPError as e: assert e.code==401
print('PASS: unauthenticated request rejected.')
