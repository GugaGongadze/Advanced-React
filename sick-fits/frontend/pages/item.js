import SingleItem from '../components/SingleItem'

const Item = ({ query }) => {
  return (
    <div>
      <SingleItem id={query.id} />
    </div>
  )
}

export default Item
