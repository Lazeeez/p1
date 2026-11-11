/* Python is loaded inside a dedicated Worker so UI stays responsive and timed-out runs can be terminated. */
let pyodide;
const HARNESS = String.raw`
import contextlib, io, json, traceback, copy, math
from collections import deque

class ListNode:
    def __init__(self, val=0, next=None):
        self.val, self.next = val, next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val, self.left, self.right = val, left, right

def convert(x):
    if isinstance(x, dict):
        if '$list' in x:
            head = None
            for val in reversed(x['$list']):
                head = ListNode(val, head)
            return head
        if '$cycle' in x:
            data = x['$cycle']
            nodes = [ListNode(val) for val in data['values']]
            for i in range(len(nodes) - 1):
                nodes[i].next = nodes[i+1]
            if nodes and data['pos'] >= 0:
                nodes[-1].next = nodes[data['pos']]
            return nodes[0] if nodes else None
        if '$tree' in x:
            values = x['$tree']
            if not values or values[0] is None:
                return None
            root = TreeNode(values[0]); queue = deque([root]); i=1
            while queue and i < len(values):
                node = queue.popleft()
                if i < len(values) and values[i] is not None:
                    node.left = TreeNode(values[i]); queue.append(node.left)
                i += 1
                if i < len(values) and values[i] is not None:
                    node.right = TreeNode(values[i]); queue.append(node.right)
                i += 1
            return root
        return {k: convert(v) for k, v in x.items()}
    if isinstance(x, list):
        return [convert(v) for v in x]
    return x

def normalize(value):
    if isinstance(value, ListNode):
        out=[]; seen=set()
        while value is not None and id(value) not in seen and len(out) < 2000:
            seen.add(id(value)); out.append(normalize(value.val)); value = value.next
        if value is not None: out.append('<cycle or very long list>')
        return out
    if isinstance(value, TreeNode):
        queue=deque([value]); result=[]
        while queue and len(result) < 2000:
            node=queue.popleft()
            if node is None:
                result.append(None)
            else:
                result.append(normalize(node.val))
                queue.extend((node.left, node.right))
        while result and result[-1] is None: result.pop()
        return result
    if isinstance(value, (list, tuple)):
        return [normalize(v) for v in value[:2000]]
    if isinstance(value, set):
        return sorted((normalize(v) for v in value),key=repr)
    if isinstance(value, dict):
        return {str(k):normalize(v) for k,v in value.items()}
    if isinstance(value, (str, bool, int, float)) or value is None:
        return value
    return repr(value)[:240]

def canonical(value, comparator):
    data = normalize(value)
    if comparator in ('unordered','points'):
        return sorted(data, key=lambda x: json.dumps(x, sort_keys=True))
    if comparator in ('groups','nestedUnordered'):
        return sorted([sorted(group,key=lambda x:json.dumps(x,sort_keys=True)) for group in data],key=lambda x:json.dumps(x,sort_keys=True))
    return data

def values_equal(a, b):
    if isinstance(a, bool) or isinstance(b, bool):
        return type(a) is type(b) and a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-9)
    if type(a) is not type(b):
        return False
    if isinstance(a, list):
        return len(a) == len(b) and all(values_equal(x, y) for x, y in zip(a, b))
    if isinstance(a, dict):
        return a.keys() == b.keys() and all(values_equal(a[k], b[k]) for k in a)
    return a == b

def equivalent(actual, expected, comparator, raw_args):
    if comparator == 'topo':
        n, prereqs = raw_args
        if expected == []:
            return actual == []
        if not isinstance(actual,list) or len(actual)!=n or sorted(actual)!=list(range(n)):
            return False
        pos={v:i for i,v in enumerate(actual)}
        return all(pos[pre]<pos[course] for course,pre in prereqs)
    return values_equal(canonical(actual,comparator), canonical(expected,comparator))

payload=json.loads(__payload_json)
output=io.StringIO(); results=[]
try:
    scope={'ListNode':ListNode,'TreeNode':TreeNode}
    with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
        exec(compile(payload['code'], '<solution.py>', 'exec'), scope)
    fn=scope.get(payload['fn'])
    if not callable(fn):
        raise NameError('Expected a callable named ' + payload['fn'])
    for idx, test in enumerate(payload['tests']):
        raw_args=copy.deepcopy(test['args'])
        args=[convert(x) for x in raw_args]
        expected=normalize(convert(test['expected']))
        try:
            with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
                actual=normalize(fn(*args))
            ok=equivalent(actual,expected,payload.get('comparator'),raw_args)
            results.append({'ok':ok,'actual':actual,'expected':expected,'index':idx})
        except Exception as e:
            results.append({'ok':False,'actual':None,'expected':expected,'index':idx,'error':type(e).__name__+': '+str(e)})
    answer={'ok':True,'results':results,'stdout':output.getvalue()[-5000:]}
except Exception:
    answer={'ok':False,'error':traceback.format_exc(limit=5)[-4000:],'results':results,'stdout':output.getvalue()[-5000:]}
json.dumps(answer)
`;
async function start() {
  try {
    importScripts('https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js');
    pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/' });
    self.postMessage({type:'ready'});
  } catch (error) {
    self.postMessage({type:'load-error',message:String(error)});
  }
}
self.onmessage=async ({data}) => {
  if(data.type!=='run' || !pyodide) return;
  try {
    pyodide.globals.set('__payload_json',JSON.stringify(data.payload));
    const raw=await pyodide.runPythonAsync(HARNESS);
    self.postMessage({type:'result',requestId:data.requestId,data:JSON.parse(raw)});
  } catch(error) {
    self.postMessage({type:'result',requestId:data.requestId,data:{ok:false,error:String(error),results:[]}});
  }
};
start();
