import axios from 'axios'

async function main() {
  const args = process.argv.slice(2)

  const command = {
    type: 'UPDATE_CELLVALUE',
    datasheetId: args[0],
    args: args.slice(1),
  }
  console.log(command)
  const res = await axios.post('http://localhost:8080/datasheet/update', command)

  console.log(res.data)
}

main().catch(console.error)
