export function NegotiationRestaurant() {
  return (
    <div className="negotiation-restaurant" aria-hidden="true">
      <div className="restaurant-windows">
        <i />
        <i />
        <i />
      </div>
      <div className="restaurant-lights" />
      <div className="restaurant-floor" />
      <div className="restaurant-pendant" />
      <div className="restaurant-plant">
        {Array.from({ length: 7 }, (_, index) => (
          <span key={index} />
        ))}
        <i />
      </div>
      <div className="restaurant-chair restaurant-chair-left" />
      <div className="restaurant-chair restaurant-chair-right" />
      <div className="restaurant-table">
        <i className="restaurant-vase">
          <span />
          <span />
          <span />
        </i>
      </div>
    </div>
  );
}
